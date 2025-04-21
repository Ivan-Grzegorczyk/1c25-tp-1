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
    host: 'graphite', // Nombre del servicio de Graphite (debería coincidir con el contenedor de Graphite)
    port: 8125,        // Puerto estándar de StatsD
    protocol: 'udp',
});

const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoints
app.get("/accounts", (req, res) => {
    statsd.increment('api.requests'); // Incrementa el contador de solicitudes
    res.json(getAccounts());
});

app.put("/accounts/:id/balance", (req, res) => {
    statsd.increment('api.requests'); // Incrementa el contador de solicitudes

    const accountId = req.params.id;
    const { balance } = req.body;

    if (!accountId || !balance) {
        return res.status(400).json({ error: "Malformed request" });
    } else {
        setAccountBalance(accountId, balance);
        res.json(getAccounts());
    }
});

// RATE endpoints
app.get("/rates", (req, res) => {
    statsd.increment('api.requests'); // Incrementa el contador de solicitudes
    res.json(getRates());
});

app.put("/rates", (req, res) => {
    statsd.increment('api.requests'); // Incrementa el contador de solicitudes

    const { baseCurrency, counterCurrency, rate } = req.body;

    if (!baseCurrency || !counterCurrency || !rate) {
        return res.status(400).json({ error: "Malformed request" });
    }

    const newRateRequest = { ...req.body };
    setRate(newRateRequest);
    res.json(getRates());
});

// LOG endpoint
app.get("/log", (req, res) => {
    statsd.increment('api.requests'); // Incrementa el contador de solicitudes
    res.json(getLog());
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

    // Enviar métricas a Graphite
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
    statsd.timing('api.exchange.latency', latency);  // Enviar la latencia de la operación
    

   // res.status(200).json({
     //   message: 'Exchange completed',
    //});
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
