import client from "./client.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const ACCOUNTS_KEY = 'accounts';
const RATES_KEY = 'rates';
const LOG_KEY = 'log';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function init() {
  const accounts = await load("../state/accounts.json");
  const rates = await load("../state/rates.json");
  const log = await load("../state/log.json");

  for (const [key, defaultValue] of [
    [ACCOUNTS_KEY, accounts],
    [RATES_KEY, rates],
    [LOG_KEY, log],
  ]) {
    const value = await client.get(key);
    if (value === null) {
      await client.set(key, JSON.stringify(defaultValue));
    }
  }
}

export async function getAccounts() {
  return JSON.parse(await client.get(ACCOUNTS_KEY));
}

export async function getRates() {
  return JSON.parse(await client.get(RATES_KEY));
}

export async function getLog() {
  return JSON.parse(await client.get(LOG_KEY));
}

export async function setAccounts(accounts) {
  await client.set(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function setRates(rates) {
  await client.set(RATES_KEY, JSON.stringify(rates));
}

export async function setLog(log) {
  await client.set(LOG_KEY, JSON.stringify(log));
}

export async function findAccountById(id) {
  const accounts = await getAccounts();
  return accounts.find((a) => a.id === Number(id)) || null;
}

export async function findAccountByCurrency(currency) {
  const accounts = await getAccounts();
  return accounts.find((a) => a.currency === currency) || null;
}

export async function updateAccount(updatedAccount) {
  const accounts = await getAccounts();
  const index = accounts.findIndex((a) => a.id === updatedAccount.id);
  if (index !== -1) {
    accounts[index] = updatedAccount;
    await setAccounts(accounts);
  }
}

export async function appendToLog(log) {
  const currentLog = await getLog();
  currentLog.push(log);
  await setLog(currentLog);
}

async function load(fileName) {
  const filePath = path.join(__dirname, fileName);

  try {
    await fs.promises.access(filePath);
    const raw = await fs.promises.readFile(filePath, "utf8");

    return JSON.parse(raw);
  } catch (err) {
    if (err.code == "ENOENT") {
      console.error(`${filePath} not found`);
    } else {
      console.error(`Error loading ${filePath}:`, err);
    }
  }
}
