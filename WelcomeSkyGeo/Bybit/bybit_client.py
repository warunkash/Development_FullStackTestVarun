import hashlib
import hmac
import time
import os
import urllib.parse

import requests

BASE_URL = "https://api.bybit.com"
RECV_WINDOW = "5000"


def _get_credentials():
    api_key = os.environ.get("BYBIT_API_KEY", "")
    api_secret = os.environ.get("BYBIT_API_SECRET", "")
    return api_key, api_secret


def _sign(api_key, api_secret, timestamp, params_str):
    payload = timestamp + api_key + RECV_WINDOW + params_str
    return hmac.new(api_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _private_headers(params_str=""):
    api_key, api_secret = _get_credentials()
    if not api_key or not api_secret:
        raise ValueError("BYBIT_API_KEY and BYBIT_API_SECRET environment variables are required for private endpoints")
    timestamp = str(int(time.time() * 1000))
    signature = _sign(api_key, api_secret, timestamp, params_str)
    return {
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": signature,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
        "Content-Type": "application/json",
    }


def _get(path, params=None, private=False):
    params = params or {}
    query_string = urllib.parse.urlencode(params)
    url = BASE_URL + path
    if private:
        headers = _private_headers(query_string)
        response = requests.get(url, params=params, headers=headers, timeout=10)
    else:
        response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def _post(path, payload=None):
    payload = payload or {}
    import json
    body = json.dumps(payload)
    headers = _private_headers(body)
    url = BASE_URL + path
    response = requests.post(url, data=body, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

def get_server_time():
    return _get("/v5/market/time")


def get_ticker(symbol, category="spot"):
    return _get("/v5/market/tickers", {"category": category, "symbol": symbol})


def get_tickers(category="spot"):
    return _get("/v5/market/tickers", {"category": category})


def get_orderbook(symbol, category="spot", limit=25):
    return _get("/v5/market/orderbook", {"category": category, "symbol": symbol, "limit": limit})


def get_kline(symbol, interval="60", category="spot", limit=200):
    return _get("/v5/market/kline", {
        "category": category,
        "symbol": symbol,
        "interval": interval,
        "limit": limit,
    })


def get_instruments(category="spot"):
    return _get("/v5/market/instruments-info", {"category": category})


# ---------------------------------------------------------------------------
# Private endpoints (require BYBIT_API_KEY + BYBIT_API_SECRET)
# ---------------------------------------------------------------------------

def get_wallet_balance(account_type="UNIFIED"):
    return _get("/v5/account/wallet-balance", {"accountType": account_type}, private=True)


def get_open_orders(category="spot", symbol=None):
    params = {"category": category}
    if symbol:
        params["symbol"] = symbol
    return _get("/v5/order/realtime", params, private=True)


def get_order_history(category="spot", symbol=None, limit=50):
    params = {"category": category, "limit": limit}
    if symbol:
        params["symbol"] = symbol
    return _get("/v5/order/history", params, private=True)


def get_positions(category="linear", symbol=None):
    params = {"category": category}
    if symbol:
        params["symbol"] = symbol
    return _get("/v5/position/list", params, private=True)


def place_order(category, symbol, side, order_type, qty, price=None, time_in_force="GTC"):
    payload = {
        "category": category,
        "symbol": symbol,
        "side": side,
        "orderType": order_type,
        "qty": str(qty),
        "timeInForce": time_in_force,
    }
    if price:
        payload["price"] = str(price)
    return _post("/v5/order/create", payload)


def cancel_order(category, symbol, order_id):
    return _post("/v5/order/cancel", {
        "category": category,
        "symbol": symbol,
        "orderId": order_id,
    })
