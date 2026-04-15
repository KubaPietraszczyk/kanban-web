export interface Card {
  id: string;
  content: string;
  description: string | null;
  isDone: boolean;
  tags: string[];
  createdAt: string;
  completedAt: string | null;
  order: number;
  listId: string;
  lockedBy: string | null;
  lockedAt: string | null;
}

export interface ListType {
  id: string;
  title: string;
  order: number;
  type: string;
  boardId: string;
  cards: Card[];
}

export interface BoardType {
  id: string;
  title: string;
  lists: ListType[];
}
