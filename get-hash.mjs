import { hashPin } from './server/lib/auth';
import fs from 'fs/promises';

async function getHash() {
    const pin = '123456';
    const hashedPin = hashPin(pin);
    await fs.writeFile('temp-hash.txt', hashedPin);
}

getHash();
