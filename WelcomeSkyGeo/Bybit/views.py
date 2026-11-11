import json

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt

from . import bybit_client as bybit


def _ok(data):
    return JsonResponse({"status": "ok", "data": data})


def _err(message, status=400):
    return JsonResponse({"status": "error", "message": str(message)}, status=status)


# ---------------------------------------------------------------------------
# Public views
# ---------------------------------------------------------------------------

@require_GET
def server_time(request):
    try:
        return _ok(bybit.get_server_time())
    except Exception as e:
        return _err(e, 502)


@require_GET
def ticker(request, symbol):
    category = request.GET.get("category", "spot")
    try:
        return _ok(bybit.get_ticker(symbol, category=category))
    except Exception as e:
        return _err(e, 502)


@require_GET
def tickers(request):
    category = request.GET.get("category", "spot")
    try:
        return _ok(bybit.get_tickers(category=category))
    except Exception as e:
        return _err(e, 502)


@require_GET
def orderbook(request, symbol):
    category = request.GET.get("category", "spot")
    limit = int(request.GET.get("limit", 25))
    try:
        return _ok(bybit.get_orderbook(symbol, category=category, limit=limit))
    except Exception as e:
        return _err(e, 502)


@require_GET
def kline(request, symbol):
    category = request.GET.get("category", "spot")
    interval = request.GET.get("interval", "60")
    limit = int(request.GET.get("limit", 200))
    try:
        return _ok(bybit.get_kline(symbol, interval=interval, category=category, limit=limit))
    except Exception as e:
        return _err(e, 502)


@require_GET
def instruments(request):
    category = request.GET.get("category", "spot")
    try:
        return _ok(bybit.get_instruments(category=category))
    except Exception as e:
        return _err(e, 502)


# ---------------------------------------------------------------------------
# Private views (require BYBIT_API_KEY + BYBIT_API_SECRET)
# ---------------------------------------------------------------------------

@require_GET
def wallet_balance(request):
    account_type = request.GET.get("accountType", "UNIFIED")
    try:
        return _ok(bybit.get_wallet_balance(account_type=account_type))
    except ValueError as e:
        return _err(e, 401)
    except Exception as e:
        return _err(e, 502)


@require_GET
def open_orders(request):
    category = request.GET.get("category", "spot")
    symbol = request.GET.get("symbol")
    try:
        return _ok(bybit.get_open_orders(category=category, symbol=symbol))
    except ValueError as e:
        return _err(e, 401)
    except Exception as e:
        return _err(e, 502)


@require_GET
def order_history(request):
    category = request.GET.get("category", "spot")
    symbol = request.GET.get("symbol")
    limit = int(request.GET.get("limit", 50))
    try:
        return _ok(bybit.get_order_history(category=category, symbol=symbol, limit=limit))
    except ValueError as e:
        return _err(e, 401)
    except Exception as e:
        return _err(e, 502)


@require_GET
def positions(request):
    category = request.GET.get("category", "linear")
    symbol = request.GET.get("symbol")
    try:
        return _ok(bybit.get_positions(category=category, symbol=symbol))
    except ValueError as e:
        return _err(e, 401)
    except Exception as e:
        return _err(e, 502)


@csrf_exempt
@require_POST
def place_order(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return _err("Invalid JSON body")

    required = ("category", "symbol", "side", "orderType", "qty")
    missing = [f for f in required if f not in body]
    if missing:
        return _err(f"Missing required fields: {', '.join(missing)}")

    try:
        return _ok(bybit.place_order(
            category=body["category"],
            symbol=body["symbol"],
            side=body["side"],
            order_type=body["orderType"],
            qty=body["qty"],
            price=body.get("price"),
            time_in_force=body.get("timeInForce", "GTC"),
        ))
    except ValueError as e:
        return _err(e, 401)
    except Exception as e:
        return _err(e, 502)


@csrf_exempt
@require_POST
def cancel_order(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return _err("Invalid JSON body")

    required = ("category", "symbol", "orderId")
    missing = [f for f in required if f not in body]
    if missing:
        return _err(f"Missing required fields: {', '.join(missing)}")

    try:
        return _ok(bybit.cancel_order(
            category=body["category"],
            symbol=body["symbol"],
            order_id=body["orderId"],
        ))
    except ValueError as e:
        return _err(e, 401)
    except Exception as e:
        return _err(e, 502)
