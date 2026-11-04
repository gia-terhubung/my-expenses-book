import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

struct ParseHints: Record {
  @Field var locale: String = "en"
  @Field var homeCurrency: String = "USD"
}

public class ReceiptAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptAI")

    AsyncFunction("getAvailability") { () -> [String: Any?] in
      #if canImport(FoundationModels)
      if #available(iOS 26, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
          return ["available": true, "engine": "apple_fm"]
        case .unavailable(let reason):
          return ["available": false, "engine": "apple_fm", "reason": Self.describe(reason)]
        }
      }
      #endif
      return ["available": false, "engine": nil, "reason": "os"]
    }

    AsyncFunction("parseReceipt") { (ocrText: String, hints: ParseHints) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26, *) {
        return try await AppleFMParser.parse(ocrText: ocrText, locale: hints.locale, homeCurrency: hints.homeCurrency)
      }
      #endif
      throw Exception(name: "ERR_UNAVAILABLE", description: "On-device model unavailable: os")
    }
  }

  #if canImport(FoundationModels)
  @available(iOS 26, *)
  private static func describe(_ reason: SystemLanguageModel.Availability.UnavailableReason) -> String {
    switch reason {
    case .deviceNotEligible: return "deviceNotEligible"
    case .appleIntelligenceNotEnabled: return "appleIntelligenceNotEnabled"
    case .modelNotReady: return "modelNotReady"
    @unknown default: return "unknown"
    }
  }
  #endif
}

#if canImport(FoundationModels)
@available(iOS 26, *)
@Generable
struct Receipt {
  @Guide(description: "Store or merchant name as printed on the receipt")
  var merchant: String
  @Guide(description: "Purchase date and time in ISO 8601, e.g. 2026-11-04T13:05:00. Empty string if absent")
  var purchasedAt: String
  @Guide(description: "Grand total paid as a plain decimal string with '.' as decimal separator and no thousands separators, e.g. 125000 or 12.50")
  var total: String
  @Guide(description: "Total tax (VAT/PPN/TVA/sales tax) as a plain decimal string, or empty string if not shown")
  var tax: String
  @Guide(description: "ISO 4217 currency code, e.g. IDR, USD, EUR, JPY")
  var currency: String
}

@available(iOS 26, *)
enum AppleFMParser {
  static func parse(ocrText: String, locale: String, homeCurrency: String) async throws -> String {
    let session = LanguageModelSession(instructions: """
      You extract structured data from noisy OCR text of a shopping receipt. \
      Use only information present in the text. If the currency is not printed, \
      infer it from the locale \(locale) or fall back to \(homeCurrency).
      """)
    let response = try await session.respond(to: ocrText, generating: Receipt.self)
    return response.rawContent.jsonString
  }
}
#endif
