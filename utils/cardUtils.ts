
import { Card, UnitType } from '../types';

export const groupCards = (cards: Card[]): Card[][] => {
  const groups: Map<UnitType, Card[]> = new Map();
  const orderedGroups: Card[][] = [];

  cards.forEach(card => {
    if (!groups.has(card.type)) {
      const group: Card[] = [];
      groups.set(card.type, group);
      orderedGroups.push(group);
    }
    groups.get(card.type)!.push(card);
  });

  return orderedGroups;
};
