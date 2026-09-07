import { questionCard } from './question.ts';
import { situationCard } from './situation.ts';
import { bridgeCard } from './bridge.ts';
import { backCard } from './back.ts';
import type { Card, CardLayout } from '../types.ts';

/** Single dispatch point. Every surface - build, inspect, proof - goes through it. */
export function layoutCard(card: Card): CardLayout {
  switch (card.type) {
    case 'question': return questionCard(card);
    case 'situation': return situationCard(card);
    case 'bridge': return bridgeCard(card);
    case 'back': return backCard();
  }
}

export { questionCard, situationCard, bridgeCard, backCard };
