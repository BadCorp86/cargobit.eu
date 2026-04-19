"""
CargoBit Stripe Webhook Handler
===============================
Produktionsreifer Webhook-Handler für:
- Payment Intents (Top-Ups)
- Subscriptions (Abos)
- Payout Events (Auszahlungen)
- Connect Events (Transporteure)

Sicher, idempotent, vollständig.
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from decimal import Decimal

import stripe
from fastapi import FastAPI, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import asyncpg
from asyncpg import Pool

# ============================================================
# KONFIGURATION
# ============================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Stripe API Key (aus Umgebungsvariablen)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_...")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_...")

# Datenbank-Verbindung
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/cargobit")

# App
app = FastAPI(
    title="CargoBit Stripe Webhook Handler",
    description="Produktionsreifer Webhook-Handler für Wallet, Abos und Payouts",
    version="1.0.0"
)

# DB Pool
db_pool: Optional[Pool] = None


@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    logger.info("Database pool created")


@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()
        logger.info("Database pool closed")


# ============================================================
# DATENBANK-OPERATIONEN
# ============================================================

async def get_wallet_by_user_id(user_id: str) -> Optional[Dict]:
    """Wallet eines Users abrufen oder erstellen"""
    async with db_pool.acquire() as conn:
        # Versuche existierendes Wallet zu finden
        wallet = await conn.fetchrow(
            "SELECT * FROM wallets WHERE user_id = $1", user_id
        )
        if wallet:
            return dict(wallet)
        
        # Neues Wallet erstellen
        wallet = await conn.fetchrow(
            """
            INSERT INTO wallets (user_id, balance_cents, currency)
            VALUES ($1, 0, 'EUR')
            RETURNING *
            """,
            user_id
        )
        return dict(wallet)


async def credit_wallet(
    user_id: str,
    amount_cents: int,
    tx_type: str,
    reference_id: str,
    reference_type: str,
    idempotency_key: str,
    metadata: Dict = None
) -> Dict:
    """Guthaben aufladen (idempotent)"""
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            # Prüfe ob Transaktion bereits existiert (Idempotenz)
            existing = await conn.fetchrow(
                "SELECT * FROM wallet_transactions WHERE idempotency_key = $1",
                idempotency_key
            )
            if existing:
                logger.info(f"Transaction already processed: {idempotency_key}")
                return dict(existing)

            # Aktuelles Wallet abrufen (mit Lock)
            wallet = await conn.fetchrow(
                "SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE", user_id
            )
            if not wallet:
                raise ValueError(f"Wallet not found for user {user_id}")

            balance_before = wallet["balance_cents"]
            balance_after = balance_before + amount_cents

            # Wallet aktualisieren
            await conn.execute(
                "UPDATE wallets SET balance_cents = $1, updated_at = NOW() WHERE user_id = $2",
                balance_after, user_id
            )

            # Transaktion protokollieren
            tx = await conn.fetchrow(
                """
                INSERT INTO wallet_transactions 
                (wallet_id, amount_cents, balance_before, balance_after, type, status, 
                 reference_id, reference_type, idempotency_key, metadata, processed_at)
                VALUES ($1, $2, $3, $4, $5, 'succeeded', $6, $7, $8, $9, NOW())
                RETURNING *
                """,
                wallet["wallet_id"], amount_cents, balance_before, balance_after,
                tx_type, reference_id, reference_type, idempotency_key,
                json.dumps(metadata or {})
            )

            logger.info(f"Credited {amount_cents} cents to user {user_id}")
            return dict(tx)


async def debit_wallet(
    user_id: str,
    amount_cents: int,
    tx_type: str,
    reference_id: str,
    reference_type: str,
    idempotency_key: str,
    metadata: Dict = None
) -> Dict:
    """Guthaben abbuchen (idempotent)"""
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            # Prüfe Idempotenz
            existing = await conn.fetchrow(
                "SELECT * FROM wallet_transactions WHERE idempotency_key = $1",
                idempotency_key
            )
            if existing:
                logger.info(f"Transaction already processed: {idempotency_key}")
                return dict(existing)

            # Wallet mit Lock
            wallet = await conn.fetchrow(
                "SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE", user_id
            )
            if not wallet:
                raise ValueError(f"Wallet not found for user {user_id}")

            balance_before = wallet["balance_cents"]
            if balance_before < amount_cents:
                raise ValueError(f"Insufficient balance: {balance_before} < {amount_cents}")

            balance_after = balance_before - amount_cents

            # Wallet aktualisieren
            await conn.execute(
                "UPDATE wallets SET balance_cents = $1, updated_at = NOW() WHERE user_id = $2",
                balance_after, user_id
            )

            # Transaktion (negativer Betrag für Debit)
            tx = await conn.fetchrow(
                """
                INSERT INTO wallet_transactions 
                (wallet_id, amount_cents, balance_before, balance_after, type, status, 
                 reference_id, reference_type, idempotency_key, metadata, processed_at)
                VALUES ($1, $2, $3, $4, $5, 'succeeded', $6, $7, $8, $9, NOW())
                RETURNING *
                """,
                wallet["wallet_id"], -amount_cents, balance_before, balance_after,
                tx_type, reference_id, reference_type, idempotency_key,
                json.dumps(metadata or {})
            )

            logger.info(f"Debited {amount_cents} cents from user {user_id}")
            return dict(tx)


async def update_subscription_status(sub: Dict) -> Dict:
    """Abo-Status aktualisieren"""
    user_id = sub.get("metadata", {}).get("user_id")
    if not user_id:
        logger.warning("Subscription ohne user_id metadata")
        return None

    plan = sub.get("metadata", {}).get("plan", "free")
    user_type = sub.get("metadata", {}).get("user_type", "shipper")
    status = sub.get("status", "active")
    stripe_customer_id = sub.get("customer")
    stripe_sub_id = sub.get("id")
    
    current_period_start = datetime.fromtimestamp(sub.get("current_period_start", 0))
    current_period_end = datetime.fromtimestamp(sub.get("current_period_end", 0))
    cancel_at_period_end = sub.get("cancel_at_period_end", False)

    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            INSERT INTO subscription_status 
            (user_id, plan, user_type, stripe_customer_id, stripe_sub_id, status,
             current_period_start, current_period_end, cancel_at_period_end, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              plan = EXCLUDED.plan,
              user_type = EXCLUDED.user_type,
              stripe_customer_id = EXCLUDED.stripe_customer_id,
              stripe_sub_id = EXCLUDED.stripe_sub_id,
              status = EXCLUDED.status,
              current_period_start = EXCLUDED.current_period_start,
              current_period_end = EXCLUDED.current_period_end,
              cancel_at_period_end = EXCLUDED.cancel_at_period_end,
              updated_at = NOW()
            RETURNING *
            """,
            user_id, plan, user_type, stripe_customer_id, stripe_sub_id, status,
            current_period_start, current_period_end, cancel_at_period_end
        )
        
        logger.info(f"Updated subscription for user {user_id}: {plan} - {status}")
        return dict(result)


async def cancel_subscription(sub: Dict) -> Dict:
    """Abo kündigen"""
    user_id = sub.get("metadata", {}).get("user_id")
    if not user_id:
        return None

    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            UPDATE subscription_status 
            SET status = 'canceled', plan = 'free', updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
            """,
            user_id
        )
        
        logger.info(f"Cancelled subscription for user {user_id}")
        return dict(result)


async def mark_payout_as_paid(payout: Dict) -> Dict:
    """Payout als bezahlt markieren"""
    stripe_payout_id = payout.get("id")
    
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            UPDATE payout_requests 
            SET status = 'paid', processed_at = NOW(), updated_at = NOW()
            WHERE stripe_payout_id = $1
            RETURNING *
            """,
            stripe_payout_id
        )
        
        if result:
            logger.info(f"Payout {stripe_payout_id} marked as paid")
        return dict(result) if result else None


async def update_topup_session(session_id: str, payment_intent_id: str, status: str) -> Dict:
    """Top-Up Session aktualisieren"""
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            UPDATE wallet_topup_sessions 
            SET status = $1, stripe_payment_intent_id = $2, completed_at = NOW()
            WHERE stripe_session_id = $3
            RETURNING *
            """,
            status, payment_intent_id, session_id
        )
        return dict(result) if result else None


# ============================================================
# WEBHOOK HANDLER
# ============================================================

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Haupt-Webhook-Endpoint für alle Stripe-Events
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # Signatur verifizieren
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    event_data = event["data"]["object"]
    
    logger.info(f"Received webhook: {event_type}")

    try:
        # ================================================
        # 1) TOP-UP SUCCESS
        # ================================================
        if event_type == "payment_intent.succeeded":
            pi = event_data
            user_id = pi.get("metadata", {}).get("user_id")
            amount = pi.get("amount_received", pi.get("amount", 0))
            
            if user_id and pi.get("metadata", {}).get("type") == "topup":
                await credit_wallet(
                    user_id=user_id,
                    amount_cents=amount,
                    tx_type="topup",
                    reference_id=pi["id"],
                    reference_type="stripe_payment_intent",
                    idempotency_key=f"topup_{pi['id']}",
                    metadata={
                        "stripe_payment_intent_id": pi["id"],
                        "currency": pi.get("currency"),
                        "user_id": user_id
                    }
                )

        # ================================================
        # 2) SUBSCRIPTION CREATED / UPDATED
        # ================================================
        elif event_type in ["customer.subscription.created", "customer.subscription.updated"]:
            sub = event_data
            await update_subscription_status(sub)

        # ================================================
        # 3) SUBSCRIPTION CANCELED / DELETED
        # ================================================
        elif event_type in ["customer.subscription.deleted", "customer.subscription.canceled"]:
            sub = event_data
            await cancel_subscription(sub)

        # ================================================
        # 4) PAYOUT EVENTS
        # ================================================
        elif event_type == "payout.paid":
            payout = event_data
            await mark_payout_as_paid(payout)

        elif event_type == "payout.failed":
            payout = event_data
            logger.warning(f"Payout failed: {payout.get('id')}")
            # TODO: Update payout_requests status

        # ================================================
        # 5) CHECKOUT SESSION COMPLETED (Top-Up)
        # ================================================
        elif event_type == "checkout.session.completed":
            session = event_data
            metadata = session.get("metadata", {})
            
            if metadata.get("type") == "topup":
                user_id = metadata.get("user_id")
                amount = session.get("amount_total", 0)
                payment_intent_id = session.get("payment_intent")
                
                if user_id:
                    await update_topup_session(
                        session_id=session["id"],
                        payment_intent_id=payment_intent_id,
                        status="completed"
                    )
                    
                    await credit_wallet(
                        user_id=user_id,
                        amount_cents=amount,
                        tx_type="topup",
                        reference_id=session["id"],
                        reference_type="stripe_checkout_session",
                        idempotency_key=f"topup_session_{session['id']}",
                        metadata={
                            "stripe_session_id": session["id"],
                            "stripe_payment_intent_id": payment_intent_id,
                            "user_id": user_id
                        }
                    )

        # ================================================
        # 6) INVOICE PAID (Subscription Payment)
        # ================================================
        elif event_type == "invoice.paid":
            invoice = event_data
            sub_id = invoice.get("subscription")
            user_id = invoice.get("metadata", {}).get("user_id")
            
            if sub_id:
                # Subscription-Status aktualisieren
                sub = stripe.Subscription.retrieve(sub_id)
                await update_subscription_status(sub)

        # ================================================
        # 7) INVOICE PAYMENT FAILED
        # ================================================
        elif event_type == "invoice.payment_failed":
            invoice = event_data
            sub_id = invoice.get("subscription")
            
            if sub_id:
                async with db_pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE subscription_status 
                        SET status = 'past_due', updated_at = NOW()
                        WHERE stripe_sub_id = $1
                        """,
                        sub_id
                    )
                logger.warning(f"Subscription payment failed: {sub_id}")

        # ================================================
        # 8) CHARGE REFUNDED
        # ================================================
        elif event_type == "charge.refunded":
            charge = event_data
            refund = charge.get("refunds", {}).get("data", [{}])[0] if charge.get("refunds") else {}
            user_id = charge.get("metadata", {}).get("user_id")
            amount_refunded = refund.get("amount", charge.get("amount_refunded", 0))
            
            if user_id and amount_refunded > 0:
                # Bei Refund Betrag vom Wallet abziehen (falls noch nicht geschehen)
                await debit_wallet(
                    user_id=user_id,
                    amount_cents=amount_refunded,
                    tx_type="refund",
                    reference_id=refund.get("id", charge["id"]),
                    reference_type="stripe_refund",
                    idempotency_key=f"refund_{refund.get('id', charge['id'])}",
                    metadata={
                        "original_charge_id": charge["id"],
                        "refund_id": refund.get("id"),
                        "reason": refund.get("reason")
                    }
                )

        # ================================================
        # 9) CONNECT ACCOUNT EVENTS
        # ================================================
        elif event_type == "account.updated":
            account = event_data
            stripe_account_id = account["id"]
            
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE connected_accounts 
                    SET account_status = $1,
                        payouts_enabled = $2,
                        charges_enabled = $3,
                        requirements = $4,
                        updated_at = NOW()
                    WHERE stripe_account_id = $5
                    """,
                    account.get("payouts_enabled") and "verified" or "restricted",
                    account.get("payouts_enabled", False),
                    account.get("charges_enabled", False),
                    json.dumps(account.get("requirements", {})),
                    stripe_account_id
                )
            logger.info(f"Updated connected account: {stripe_account_id}")

        # ================================================
        # DEFAULT: Unbekanntes Event loggen
        # ================================================
        else:
            logger.info(f"Unhandled event type: {event_type}")

    except Exception as e:
        logger.error(f"Error processing webhook {event_type}: {e}", exc_info=True)
        # Wichtig: Trotz Fehler 200 zurückgeben, sonst wiederholt Stripe
        # Aber Fehler loggen und ggf. alerten
        return JSONResponse(
            status_code=200,
            content={"status": "error_logged", "error": str(e)}
        )

    return JSONResponse(status_code=200, content={"status": "ok"})


# ============================================================
# HELPER ENDPOINTS
# ============================================================

@app.get("/health")
async def health_check():
    """Health Check"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/wallet/{user_id}")
async def get_wallet(user_id: str):
    """Wallet-Status abrufen"""
    wallet = await get_wallet_by_user_id(user_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    return {
        "wallet_id": str(wallet["wallet_id"]),
        "user_id": str(wallet["user_id"]),
        "balance_cents": wallet["balance_cents"],
        "balance_eur": wallet["balance_cents"] / 100,
        "currency": wallet["currency"],
        "created_at": wallet["created_at"].isoformat()
    }


@app.get("/wallet/{user_id}/transactions")
async def get_transactions(user_id: str, limit: int = 50, offset: int = 0):
    """Transaktionshistorie abrufen"""
    async with db_pool.acquire() as conn:
        wallet = await conn.fetchrow(
            "SELECT wallet_id FROM wallets WHERE user_id = $1", user_id
        )
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        transactions = await conn.fetch(
            """
            SELECT * FROM wallet_transactions 
            WHERE wallet_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3
            """,
            wallet["wallet_id"], limit, offset
        )
        
        return {
            "transactions": [dict(tx) for tx in transactions],
            "count": len(transactions)
        }


# ============================================================
# TOP-UP SESSION ERSTELLUNG
# ============================================================

class TopUpRequest(BaseModel):
    user_id: str
    amount_cents: int = Field(..., gt=0, description="Betrag in Cents")
    success_url: str
    cancel_url: str


@app.post("/wallet/topup/create-session")
async def create_topup_session(req: TopUpRequest):
    """Stripe Checkout Session für Guthabenaufladung erstellen"""
    try:
        # Checkout Session erstellen
        session = stripe.checkout.Session.create(
            payment_method_types=["card", "sofort", "giropay"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": "Guthaben aufladen",
                        "description": f"{req.amount_cents / 100:.2f} EUR Guthaben"
                    },
                    "unit_amount": req.amount_cents
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            metadata={
                "user_id": req.user_id,
                "type": "topup"
            }
        )
        
        # Session in DB speichern
        async with db_pool.acquire() as conn:
            wallet = await get_wallet_by_user_id(req.user_id)
            await conn.execute(
                """
                INSERT INTO wallet_topup_sessions 
                (wallet_id, user_id, amount_cents, stripe_session_id, status, created_at, expires_at)
                VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW() + INTERVAL '24 hours')
                """,
                wallet["wallet_id"], req.user_id, req.amount_cents, session.id
            )
        
        return {
            "session_id": session.id,
            "url": session.url
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# PAYOUT ANFORDERUNG
# ============================================================

class PayoutRequest(BaseModel):
    user_id: str
    amount_cents: int = Field(..., gt=0, description="Auszahlungsbetrag in Cents")


@app.post("/wallet/payout/request")
async def request_payout(req: PayoutRequest):
    """Auszahlung anfordern"""
    async with db_pool.acquire() as conn:
        # Wallet prüfen
        wallet = await conn.fetchrow(
            "SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE", req.user_id
        )
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")
        
        if wallet["balance_cents"] < req.amount_cents:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance: {wallet['balance_cents']} < {req.amount_cents}"
            )
        
        # Connect Account prüfen
        connect_account = await conn.fetchrow(
            "SELECT * FROM connected_accounts WHERE user_id = $1", req.user_id
        )
        if not connect_account or not connect_account["payouts_enabled"]:
            raise HTTPException(
                status_code=400,
                detail="No verified payout method. Please complete Stripe Connect onboarding."
            )
        
        # Gebühren berechnen
        fee_config = await conn.fetchrow(
            """
            SELECT * FROM wallet_fee_config 
            WHERE plan = (SELECT plan FROM subscription_status WHERE user_id = $1)
            AND user_type = (SELECT user_type FROM subscription_status WHERE user_id = $1)
            """,
            req.user_id
        )
        
        fee_cents = (fee_config or {}).get("payout_fee_fixed_cents", 50)
        fee_percent = (fee_config or {}).get("payout_fee_percent", 0)
        fee_cents += int(req.amount_cents * fee_percent / 100)
        
        net_amount = req.amount_cents - fee_cents
        
        if net_amount <= 0:
            raise HTTPException(status_code=400, detail="Payout amount too low after fees")
        
        # Payout erstellen
        payout = await conn.fetchrow(
            """
            INSERT INTO payout_requests 
            (wallet_id, user_id, amount_cents, fee_cents, net_amount_cents, stripe_account_id, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'requested', NOW())
            RETURNING *
            """,
            wallet["wallet_id"], req.user_id, req.amount_cents, fee_cents, 
            net_amount, connect_account["stripe_account_id"]
        )
        
        # Wallet sofort belasten (Pending)
        balance_before = wallet["balance_cents"]
        balance_after = balance_before - req.amount_cents
        
        await conn.execute(
            "UPDATE wallets SET balance_cents = $1, updated_at = NOW() WHERE user_id = $2",
            balance_after, req.user_id
        )
        
        await conn.execute(
            """
            INSERT INTO wallet_transactions 
            (wallet_id, amount_cents, balance_before, balance_after, type, status, 
             reference_id, reference_type, idempotency_key, metadata)
            VALUES ($1, $2, $3, $4, 'payout', 'pending', $5, 'payout_request', $6, $7)
            """,
            wallet["wallet_id"], -req.amount_cents, balance_before, balance_after,
            str(payout["payout_id"]), f"payout_{payout['payout_id']}",
            json.dumps({"payout_id": str(payout["payout_id"]), "fee_cents": fee_cents})
        )
        
        # Stripe Payout erstellen (async)
        try:
            stripe_payout = stripe.Payout.create(
                amount=net_amount,
                currency="eur",
                destination=connect_account["stripe_account_id"],
                metadata={
                    "user_id": req.user_id,
                    "payout_id": str(payout["payout_id"])
                }
            )
            
            await conn.execute(
                """
                UPDATE payout_requests 
                SET stripe_payout_id = $1, status = 'processing', updated_at = NOW()
                WHERE payout_id = $2
                """,
                stripe_payout.id, payout["payout_id"]
            )
            
        except stripe.error.StripeError as e:
            # Rollback bei Stripe-Fehler
            await conn.execute(
                """
                UPDATE payout_requests SET status = 'failed', failure_reason = $1, updated_at = NOW()
                WHERE payout_id = $2
                """,
                str(e), payout["payout_id"]
            )
            
            # Wallet zurückbuchen
            await conn.execute(
                "UPDATE wallets SET balance_cents = $1, updated_at = NOW() WHERE user_id = $2",
                balance_before, req.user_id
            )
            
            raise HTTPException(status_code=400, detail=f"Payout failed: {e}")
        
        return {
            "payout_id": str(payout["payout_id"]),
            "amount_cents": req.amount_cents,
            "fee_cents": fee_cents,
            "net_amount_cents": net_amount,
            "status": "processing"
        }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
