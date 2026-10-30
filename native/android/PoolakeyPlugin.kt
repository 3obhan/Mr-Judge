package __APP_ID__

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import ir.cafebazaar.poolakey.*
import ir.cafebazaar.poolakey.config.*
import ir.cafebazaar.poolakey.request.*

/**
 * Capacitor bridge to Cafe Bazaar's Poolakey in-app billing SDK.
 * JS side: src/lib/billing.js  (window.Capacitor.Plugins.Poolakey)
 * Error codes sent to JS: BAZAAR_NOT_FOUND, CANCELED, FAILED
 */
@CapacitorPlugin(name = "Poolakey")
class PoolakeyPlugin : Plugin() {

    private var payment: Payment? = null
    private var connection: Connection? = null
    private var connected = false

    private fun codeFor(t: Throwable?): String {
        val name = t?.javaClass?.simpleName ?: ""
        return if (name.contains("BazaarNotFound", ignoreCase = true)) "BAZAAR_NOT_FOUND" else "FAILED"
    }

    private fun fail(call: PluginCall, t: Throwable?, code: String = codeFor(t)) {
        call.reject(t?.message ?: code, code)
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        if (connected && payment != null) { call.resolve(); return }
        val key = call.getString("rsaKey") ?: ""
        activity.runOnUiThread {
            val security = if (key.isBlank()) SecurityCheck.Disable else SecurityCheck.Enable(rsaPublicKey = key)
            val p = Payment(context = context, config = PaymentConfiguration(localSecurityCheck = security))
            payment = p
            connection = p.connect {
                connectionSucceed { connected = true; call.resolve() }
                connectionFailed { t -> connected = false; fail(call, t) }
                disconnected { connected = false }
            }
        }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val p = payment
        val productId = call.getString("productId")
        if (p == null || !connected || productId == null) { call.reject("Not connected", "FAILED"); return }
        val payload = call.getString("payload") ?: ""
        activity.runOnUiThread {
            p.purchaseProduct(
                registry = activity.activityResultRegistry,
                request = PurchaseRequest(productId = productId, payload = payload)
            ) {
                failedToBeginFlow { t -> fail(call, t) }
                purchaseSucceed { info ->
                    val o = JSObject()
                    o.put("purchaseToken", info.purchaseToken)
                    o.put("orderId", info.orderId)
                    o.put("productId", info.productId)
                    call.resolve(o)
                }
                purchaseCanceled { call.reject("Canceled", "CANCELED") }
                purchaseFailed { t -> fail(call, t) }
            }
        }
    }

    @PluginMethod
    fun consume(call: PluginCall) {
        val p = payment
        val token = call.getString("purchaseToken")
        if (p == null || !connected || token == null) { call.reject("Not connected", "FAILED"); return }
        p.consumeProduct(token) {
            consumeSucceed { call.resolve() }
            consumeFailed { t -> fail(call, t) }
        }
    }

    @PluginMethod
    fun getPurchased(call: PluginCall) {
        val p = payment
        if (p == null || !connected) { call.reject("Not connected", "FAILED"); return }
        p.getPurchasedProducts {
            querySucceed { list ->
                val arr = JSArray()
                list.forEach { info ->
                    val o = JSObject()
                    o.put("purchaseToken", info.purchaseToken)
                    o.put("orderId", info.orderId)
                    o.put("productId", info.productId)
                    arr.put(o)
                }
                val res = JSObject()
                res.put("purchases", arr)
                call.resolve(res)
            }
            queryFailed { t -> fail(call, t) }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        connection?.disconnect()
        connected = false
        call.resolve()
    }

    override fun handleOnDestroy() {
        connection?.disconnect()
        connected = false
        super.handleOnDestroy()
    }
}
