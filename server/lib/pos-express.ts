import express, { Express } from "express";
import { POSStorage } from "../storage";

class POSExpress {
  private app: Express;
  private storage: POSStorage;

  constructor(storage: POSStorage) {
    this.app = express();
    this.storage = storage;
    this.app.use(express.json());
  }

  post(
    path: string,
    handler: (
      req: express.Request,
      res: express.Response,
      storage: POSStorage
    ) => void
  ) {
    this.app.post(path, (req, res) => handler(req, res, this.storage));
  }

  get(
    path: string,
    handler: (
      req: express.Request,
      res: express.Response,
      storage: POSStorage
    ) => void
  ) {
    this.app.get(path, (req, res) => handler(req, res, this.storage));
  }

  listen(port: number, callback: () => void) {
    return this.app.listen(port, callback);
  }
}

export { POSExpress };