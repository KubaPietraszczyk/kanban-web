import { Server } from 'socket.io';
import { httpServer } from './expressApp.js';
import { JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken'
import prisma from './prisma.js';

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error: Token missing"));
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as { userId: string, name: string };
        (socket as any).data = { user: decoded };
        next();
    } catch {
        next(new Error("Authentication error: Invalid token"));
    }
});

io.on('connection', (socket) => {
    const user = (socket as any).data.user;
    console.log(` User connected: ${user.name} (${socket.id})`);

    socket.on('card:locked', async (cardId, callback) => {
        try {
            const card = await prisma.card.findUnique({ where: { id: cardId } });
            if (card && (!card.lockedBy || card.lockedBy === user.userId)) {
                await prisma.card.update({
                    where: { id: cardId },
                    data: { lockedBy: user.userId, lockedByName: user.name, lockedAt: new Date() }
                });
                socket.broadcast.emit('card:locked', { cardId, lockedBy: user.userId, lockedByName: user.name });
                if (callback) callback({ success: true });
            } else if (callback) {
                callback({ error: "Card already locked by another user" });
            }
        } catch (error: any) {
            console.error("Card lock error:", error);
            if (callback) callback({ error: error.message });
        }
    });

    socket.on('card:unlocked', async (cardId, callback) => {
        try {
            await prisma.card.update({
                where: { id: cardId },
                data: { lockedBy: null, lockedByName: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked', { cardId });
            if (callback) callback({ success: true });
        } catch (error: any) {
            console.error("Card unlock error:", error);
            if (callback) callback({ error: error.message });
        }
    });

    socket.on('cards:reordered', async (items, callback) => {
        try {
            const cardIds = items.map((i: any) => i.id);
            const existingCards = await prisma.card.findMany({ where: { id: { in: cardIds } } });

            await prisma.$transaction(
                items.map((item: any) => {
                    const dbCard = existingCards.find(c => c.id === item.id);
                    const isMyLock = dbCard && dbCard.lockedBy === user.userId;

                    return prisma.card.update({
                        where: { id: item.id },
                        data: {
                            listId: item.listId,
                            order: item.order,
                            lockedBy: isMyLock ? null : undefined,
                            lockedByName: isMyLock ? null : undefined,
                            lockedAt: isMyLock ? null : undefined
                        }
                    });
                })
            );
            socket.broadcast.emit('cards:reordered', items);
            if (callback) callback({ success: true });
        } catch (error: any) {
            console.error("Cards reorder error:", error);
            if (callback) callback({ error: error.message || "Failed to reorder cards" });
        }
    });

    socket.on('lists:reordered', async (items, callback) => {
        try {
            await prisma.$transaction(
                items.map((item: any) =>
                    prisma.list.update({
                        where: { id: item.id },
                        data: { order: item.order }
                    })
                )
            );
            socket.broadcast.emit('lists:reordered', items);
            if (callback) callback({ success: true });
        } catch (error: any) {
            console.error("Lists reorder error:", error);
            if (callback) callback({ error: error.message || "Failed to reorder lists" });
        }
    });

    socket.on('disconnect', async () => {
        console.log(` User disconnected: ${user.name} (${socket.id})`);
        try {
            await prisma.card.updateMany({
                where: { lockedBy: user.userId },
                data: { lockedBy: null, lockedByName: null, lockedAt: null }
            });
            socket.broadcast.emit('card:unlocked_all', { userId: user.userId });
        } catch (error) {
            console.error("Disconnect cleanup error:", error);
        }
    });
});

export default io