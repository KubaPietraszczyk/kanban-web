import type { Request, Response, NextFunction } from 'express';

const authorize = (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
        res.status(401).send("Please provide an authorization header")
        return
    }

    req.clientId = req.headers.authorization;

    next()
}

export default authorize