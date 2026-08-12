export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  history: number[];
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  from: "user" | "jarvis";
  text: string;
}
