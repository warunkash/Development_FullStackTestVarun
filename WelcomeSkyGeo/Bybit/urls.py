from django.urls import path
from . import views

urlpatterns = [
    # Public
    path("time/", views.server_time, name="bybit-server-time"),
    path("tickers/", views.tickers, name="bybit-tickers"),
    path("ticker/<str:symbol>/", views.ticker, name="bybit-ticker"),
    path("orderbook/<str:symbol>/", views.orderbook, name="bybit-orderbook"),
    path("kline/<str:symbol>/", views.kline, name="bybit-kline"),
    path("instruments/", views.instruments, name="bybit-instruments"),

    # Private (require BYBIT_API_KEY + BYBIT_API_SECRET env vars)
    path("wallet/", views.wallet_balance, name="bybit-wallet"),
    path("orders/open/", views.open_orders, name="bybit-open-orders"),
    path("orders/history/", views.order_history, name="bybit-order-history"),
    path("orders/place/", views.place_order, name="bybit-place-order"),
    path("orders/cancel/", views.cancel_order, name="bybit-cancel-order"),
    path("positions/", views.positions, name="bybit-positions"),
]
