import type { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

const cardExists = (allowNull: boolean) => async (req: Request, res: Response, next: NextFunction) => {
    if (typeof req.params.id !== "string") {
        res.status(400).send("Please provide a card ID")
        return
    }

    req.cardId = req.params.id;

    const card = await prisma.task.findFirst({
        where: { id: req.cardId }
    });

    req.cardExists = (card !== null)

    if (!allowNull && !req.cardExists) {
        res.status(404).send("Card with a given ID doesn't exist")
        return
    } 

    if (req.cardExists) {
        req.card = card
    }

    next()
}

const listExists = (allowNull: boolean) => async (req: Request, res: Response, next: NextFunction) => {
    if (typeof req.params.id !== "string") {
        res.status(400).send("Please provide a list ID")
        return
    }

    req.cardId = req.params.id;

    const card = await prisma.column.findFirst({
        where: { id: req.cardId }
    });

    req.cardExists = (card !== null)

    if (!allowNull && !req.cardExists) {
        res.status(404).send("List with a given ID doesn't exist")
        return
    } 

    next()
}

export { cardExists, listExists}