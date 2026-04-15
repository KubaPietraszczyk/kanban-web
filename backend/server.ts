import "dotenv/config";
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import prisma from "./src/lib/prisma.js";

import authorize from './src/middleware/authorize.js'
import { cardExists, listExists } from "./src/middleware/exists.js";




const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

app.use(cors());
app.use(express.json());


// TODO: notify clients after each change

// Return the entire board ( with every list and task )
app.get('/board', async (req, res) => {
    try {
        const boards = await prisma.board.findMany({
            include: {
                columns: {
                    include: {
                        tasks: true,
                    },
                    orderBy: { order: 'asc' },
                },
            },
        });
        res.json(boards);
    } catch (error) {
        res.status(500).json({ error: "Błąd podczas pobierania tablic" });
    }
});

// Process card lock requests
app.post("/card/:id/lock", authorize, cardExists(true), async (req, res) => {
    const cardId = req.params["id"]

    if (req.card.lockedBy !== null) {
        res.status(423).send("This card is already locked")
        return
    }

    await prisma.task.update({
        where: { id: cardId },
        data: {
            lockedAt: new Date(),
            lockedBy: req.clientId
        }
    })

    // TODO: notify clients about lock

    res.status(100).send("Awaiting PUT /cards/:id request...") 
})

// Create/Edit a card
app.put("/cards/:id", authorize, cardExists(false), async (req, res) => {
    if (req.body === undefined || !("content" in req.body && "columnId" in req.body)) {
        res.status(400).send("Incomplete request body.")
        return
    }

    // Card creation
    if (!req.cardExists) {
        console.log("created")
        prisma.task.create({
            data: {
                id: req.cardId,
                order: 0, // ? TODO
                content: req.body["content"],
                columnId: req.body["columnId"]
            }
        })
        res.status(201).send()

        return
    }

    // Card editing
    if (req.card.lockedBy !== null && req.card.lockedBy !== req.clientId) {
        res.status(423).send("This card is currently being edited by another user.")
        return
    }

    console.log("updated")
    await prisma.task.update({
        where: { id: req.cardId },
        data: { 
            content: req.body["content"],
            lockedBy: null    
        }

    })

    // TODO: notify clients that the card is available to edit
    // TODO: handle user disconnection while editing
    
    res.status(200).send()
})

// Delete card
app.delete("/cards/:id", authorize, cardExists(true), async (req, res) => {
    const cardId = req.params["id"]

    if (req.card.lockedBy !== null && req.card.lockedBy !== req.clientId) {
        res.status(423).send("This card is currently being edited by another user.")
        return
    }

    prisma.task.delete({
        where: { id: cardId }
    })

    res.status(204).send()
})



const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Serwer działa z obsługą Socket.io na http://localhost:${PORT}`);
});