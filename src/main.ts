import "./style.css";
import { Game } from "./systems/Game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const game = new Game(app);
void game.start();
