import { authMiddleware } from "../middleware/auth.js";
import { cardPatchSchema, cardSchema, cardUpdateSchema } from "../lib/zodSchemas.js";
import prisma from "../lib/prisma.js";
import io from "../lib/socketio.js";
import { type AuthRequest } from "../types.js";
import express from 'express'

const cardsRouter = express.Router();

// /api/cards Endpoints

cardsRouter.post('/', authMiddleware, async (req, res) => {
    try {
        const parsed = cardSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { content, listId, priority } = parsed.data;

        const listExists = await prisma.list.findUnique({ where: { id: listId } });
        if (!listExists) return res.status(404).json({ error: "List not found" });

        const count = await prisma.card.count({ where: { listId } });
        const card = await prisma.card.create({
            data: { content, listId, order: count, priority: priority || "Medium" },
            include: { tags: true, members: true }
        });
        io.emit('card:synced', card);
        res.json(card);
    } catch (e) {
        res.status(500).json({ error: "Failed to create card" });
    }
});



cardsRouter.put('/:id', authMiddleware, async (req, res) => {
    try {
        const parsed = cardUpdateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { content, description, isDone, inProgress, tags, listId, priority } = parsed.data;

        const existing = await prisma.card.findUnique({ where: { id: req.params.id as string } });
        if (!existing) return res.status(404).json({ error: "Card not found" });

        const authReq = req as AuthRequest;
        if (existing.lockedBy && authReq.user && existing.lockedBy !== authReq.user.userId) {
            return res.status(403).json({ error: "Card is locked by another user" });
        }

        let completedAt = existing.completedAt;
        if (isDone !== undefined) {
            if (isDone && !existing.isDone) completedAt = new Date();
            if (!isDone && existing.isDone) completedAt = null;
        }

        const data: any = {};
        if (content !== undefined) data.content = content;
        if (description !== undefined) data.description = description;
        if (priority !== undefined) data.priority = priority;
        if (tags !== undefined) {
            data.tags = { set: tags.map((id: string) => ({ id })) };
        }
        if (listId !== undefined) {
            const destListExists = await prisma.list.findUnique({ where: { id: listId } });
            if (!destListExists) return res.status(404).json({ error: "Destination list not found" });
            data.listId = listId;
        }
        if (inProgress !== undefined) data.inProgress = inProgress;
        if (isDone !== undefined) {
            data.isDone = isDone;
            data.completedAt = completedAt;
        }

        const card = await prisma.card.update({
            where: { id: req.params.id as string },
            data,
            include: { tags: true, members: true }
        });
        io.emit('card:synced', card);
        res.json(card);
    } catch (e) {
        res.status(500).json({ error: "Failed to update card" });
    }
});

cardsRouter.patch('/:cardId/members/:userId', authMiddleware, async (req, res) => {
    try {
        const parsed = cardPatchSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
        const { isMember } = parsed.data;

        const user = await prisma.user.findUnique({ where: { id: req.params.userId as string } });
        if (!user) return res.status(404).json({ error: "User not found" });

        let membersChange = {}
        if (isMember) {
            membersChange = { connect: { id: req.params.userId as string } }
        } else {
            membersChange = { disconnect: { id: req.params.userId as string } }
        }
        const card = await prisma.card.update({
                where: { id: req.params.cardId as string },
                data: {
                    members: membersChange
                },
                include: {
                    tags: true,
                    members: true
                }
            }); 

        io.emit('card:synced', card);
        res.json(card);
    } catch (e) {
        res.status(500).json({ error: "Failed to update card" });
    }
})

cardsRouter.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.card.delete({ where: { id: req.params.id as string } });
        io.emit('card:deleted', req.params.id as string);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete card" });
    }
});

cardsRouter.get("/search", authMiddleware, async (req, res) => {
    const targetBoard = req.query.board as string;
    let boardFilter = {}
    if (req.query.board !== undefined) {
        boardFilter = {
            list: {
                boardId: targetBoard
            }
        } 
    }

    const query = req.query.q as string;
    if (!query) return res.json([]);

    const cards = await prisma.card.findMany({
        where: {
            AND: [
                boardFilter,
                { 
                    content: { contains: query, mode: 'insensitive' } 
                }
            ]
        },
        include: {
            members: true,
            tags: true
        },
        take: 10
    })

    res.json(cards)
})

export default cardsRouter