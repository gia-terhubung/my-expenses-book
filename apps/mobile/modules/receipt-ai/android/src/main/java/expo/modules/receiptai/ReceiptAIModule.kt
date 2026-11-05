package expo.modules.receiptai

import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ParseHints : Record {
  @Field val locale: String = "en"
  @Field val homeCurrency: String = "USD"
}

class ReceiptAIModule : Module() {
  // One client for the module lifetime; created on first use, closed in OnDestroy.
  private val client: GenerativeModel by lazy { Generation.getClient() }

  override fun definition() = ModuleDefinition {
    Name("ReceiptAI")

    OnDestroy {
      try {
        client.close()
      } catch (e: Exception) {
        // best effort
      }
    }

    AsyncFunction("getAvailability") Coroutine { ->
      availability()
    }

    AsyncFunction("parseReceipt") Coroutine { ocrText: String, hints: ParseHints ->
      val status = try {
        client.checkStatus()
      } catch (e: Exception) {
        throw CodedException("ERR_UNAVAILABLE", "On-device model unavailable", e)
      }
      // DOWNLOADABLE/DOWNLOADING count as unavailable: the app never triggers a model download.
      if (status != FeatureStatus.AVAILABLE) {
        throw CodedException("ERR_UNAVAILABLE", "On-device model unavailable", null)
      }
      val response = client.generateContent(buildPrompt(ocrText, hints))
      response.candidates.firstOrNull()?.text ?: ""
    }
  }

  private suspend fun availability(): Map<String, Any?> {
    val status = try {
      client.checkStatus()
    } catch (e: Exception) {
      return mapOf("available" to false, "engine" to null, "reason" to "device")
    }
    return when (status) {
      FeatureStatus.AVAILABLE -> mapOf("available" to true, "engine" to "gemini_nano")
      FeatureStatus.DOWNLOADABLE -> mapOf("available" to false, "engine" to "gemini_nano", "reason" to "downloadable")
      FeatureStatus.DOWNLOADING -> mapOf("available" to false, "engine" to "gemini_nano", "reason" to "downloading")
      else -> mapOf("available" to false, "engine" to null, "reason" to "device")
    }
  }

  private fun buildPrompt(ocrText: String, hints: ParseHints): String =
    """
Extract structured data from this noisy OCR text of a shopping receipt.
Reply with ONLY a JSON object, no prose, with exactly these string fields:
{"merchant": string, "purchasedAt": ISO 8601 date-time or "", "total": plain decimal string using "." and no thousands separators, "tax": plain decimal string or "", "currency": ISO 4217 code}
If the currency is not printed, infer it from locale ${hints.locale} or use ${hints.homeCurrency}.
OCR text:
$ocrText""".trimStart()
}
