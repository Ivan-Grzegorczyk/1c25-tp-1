import express from "express";
import { StatsD } from "node-statsd"; // Requerir StatsD

import {
  init as exchangeInit,
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";

await exchangeInit();

// Crear una instancia del cliente StatsD
const statsd = new StatsD({
  host: 'graphite', // Nombre del servicio de Graphite (deber�a coincidir con el contenedor de Graphite)
  port: 8125,        // Puerto est�ndar de StatsD
  protocol: 'udp',
});

const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoints
app.get("/accounts", async (req, res) => {
  statsd.increment('api.requests'); // Incrementa el contador de solicitudes
  res.json(await getAccounts());
});

app.put("/accounts/:id/balance", async (req, res) => {
  statsd.increment('api.requests'); // Incrementa el contador de solicitudes

  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || !balance) {
    return res.status(400).json({ error: "Malformed request" });
  } else {
    await setAccountBalance(accountId, balance);
    res.json(await getAccounts());
  }
});

// RATE endpoints
app.get("/rates", async (req, res) => {
  statsd.increment('api.requests'); // Incrementa el contador de solicitudes
  res.json(await getRates());
});

app.put("/rates", async (req, res) => {
  statsd.increment('api.requests'); // Incrementa el contador de solicitudes

  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || !rate) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const newRateRequest = { ...req.body };
  await setRate(newRateRequest);
  res.json(await getRates());
});

// LOG endpoint
app.get("/log", async (req, res) => {
  statsd.increment('api.requests'); // Incrementa el contador de solicitudes
  res.json(await getLog());
});

// EXCHANGE endpoint
app.post("/exchange", async (req, res) => {
  const start = Date.now();  // Empieza a medir el tiempo de la solicitud
  statsd.increment('api.requests'); // Incrementa el contador de solicitudes

  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
    transactionType,  // 'buy' o 'sell'
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount ||
    !transactionType
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  if (exchangeResult.ok) {
    res.status(200).json(exchangeResult);
  } else {
    res.status(500).json(exchangeResult);
  }

  // Enviar m�tricas a Graphite
  statsd.increment(`arvault.exchange.volume.${baseCurrency}`, baseAmount);  // Incrementa volumen moneda base
  statsd.increment(`arvault.exchange.volume.${counterCurrency}`, baseAmount); // Incrementa volumen moneda contraria

  if (transactionType === 'buy') {
    statsd.increment(`arvault.exchange.neto.${baseCurrency}`, baseAmount);  // Compra: suma moneda base
    statsd.decrement(`arvault.exchange.neto.${counterCurrency}`, baseAmount); // Compra: resta moneda contraria
  } else if (transactionType === 'sell') {
    statsd.decrement(`arvault.exchange.neto.${baseCurrency}`, baseAmount);  // Venta: resta moneda base
    statsd.increment(`arvault.exchange.neto.${counterCurrency}`, baseAmount); // Venta: suma moneda contraria
  }

  const latency = Date.now() - start;  // Calcular el tiempo de respuesta
  console.log("Latency:", latency);  // DEBUG
  statsd.timing('api.exchange.latency', latency);  // Enviar la latencia de la operaci�n
});

// Endpoint de ping para probar el servidor
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
