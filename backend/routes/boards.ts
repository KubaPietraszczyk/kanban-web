import { authMiddleware } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { Prisma } from '../generated/prisma/index.js';
import express from 'express'

const boardsRouter = express.Router();

// /api/boards Endpoints

boardsRouter.get('/', authMiddleware, async (req, res) => {
    try {
        let boards = await prisma.board.findMany({
            select: { id: true, title: true }
        });

        // Create default board if none exists
        if (boards.length === 0) {
            const newBoard = await prisma.board.create({
                data: { title: "Main Board" },
                select: { id: true, title: true }
            });
            boards = [newBoard];
        }

        res.json(boards);
    } catch (error) {
        res.status(500).json({ error: "Error fetching boards" });
    }
});

boardsRouter.get('/:id', authMiddleware, async (req, res) => {
    try {
        const board = await prisma.board.findUnique({
            where: { id: req.params.id as string },
            include: {
                lists: {
                    include: { cards: { include: { tags: true }, orderBy: { order: 'asc' } } },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!board) return res.status(404).json({ error: "Board not found" });

        // Board type inference using Prisma
        type BoardWithLists = Prisma.BoardGetPayload<{
            include: { lists: { include: { cards: { include: { tags: true } } } } }
        }>;

        const validBoard = board as BoardWithLists;

        // Ensure Telemetry list exists for the board
        if (!validBoard.lists.find((l) => l.type === 'TELEMETRY')) {
            const telList = await prisma.list.create({
                data: { title: "Telemetria", boardId: validBoard.id, order: validBoard.lists.length, type: "TELEMETRY" },
                include: { cards: { include: { tags: true } } }
            });
            validBoard.lists.push(telList as any);
        }

        res.json(validBoard);
    } catch (error) {
        res.status(500).json({ error: "Error fetching board details" });
    }
});

export default boardsRouter