package expo.modules.receiptocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream

class ReceiptOcrModule : Module() {
  private var recognizer: TextRecognizer? = null

  override fun definition() = ModuleDefinition {
    Name("ReceiptOcr")

    // `languages` is accepted for API parity with iOS; the bundled Latin model covers id/en/es/pt.
    AsyncFunction("recognizeText") Coroutine { uri: String, _: List<String> ->
      withContext(Dispatchers.IO) { guarded { recognize(uri) } }
    }

    AsyncFunction("imageHash") Coroutine { uri: String ->
      withContext(Dispatchers.IO) { guarded { dHash(uri) } }
    }

    OnDestroy {
      recognizer?.close()
      recognizer = null
    }
  }

  private inline fun <T> guarded(block: () -> T): T =
    try {
      block()
    } catch (e: CodedException) {
      throw e
    } catch (e: Throwable) {
      throw CodedException("ERR_OCR", e.message ?: e.javaClass.simpleName, e)
    }

  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_OCR", "React context unavailable", null)

  private fun client(): TextRecognizer =
    recognizer ?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).also { recognizer = it }

  // region Loading

  private fun open(uri: String): InputStream {
    val stream = if (uri.startsWith("/")) {
      File(uri).inputStream()
    } else {
      context.contentResolver.openInputStream(Uri.parse(uri))
    }
    return stream ?: throw CodedException("ERR_OCR", "Cannot open image", null)
  }

  private fun exifOrientation(uri: String): Int =
    try {
      open(uri).use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }

  /** Decodes with a power-of-two subsample so the long side stays below 2 × maxPixel. */
  private fun decode(uri: String, maxPixel: Int): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw CodedException("ERR_OCR", "Cannot decode image", null)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxPixel) sample *= 2
    val opts = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return open(uri).use { BitmapFactory.decodeStream(it, null, opts) }
      ?: throw CodedException("ERR_OCR", "Cannot decode image", null)
  }

  // endregion

  // region OCR

  private class Pass(
    val observations: List<Map<String, Any>>,
    val tallFraction: Double,
    val meanConfidence: Double,
    /** Share of multi-word lines whose first word sits left of the last (upright frame → 1.0). */
    val forwardFraction: Double,
    val width: Int,
    val height: Int,
    val rotation: Int,
  )

  private fun recognize(uri: String): Map<String, Any> {
    val t0 = System.currentTimeMillis()
    // EXIF rotation is folded into the InputImage rotation instead of copying the bitmap.
    val exifDegrees = when (exifOrientation(uri)) {
      ExifInterface.ORIENTATION_ROTATE_90, ExifInterface.ORIENTATION_TRANSPOSE -> 90
      ExifInterface.ORIENTATION_ROTATE_180 -> 180
      ExifInterface.ORIENTATION_ROTATE_270, ExifInterface.ORIENTATION_TRANSVERSE -> 270
      else -> 0
    }
    val bitmap = decode(uri, 4096)
    try {
      var best = pass(bitmap, exifDegrees, 0)
      if (best.observations.isNotEmpty() && best.tallFraction > 0.6) {
        // Bake-off photo 21: sideways label. Try both quarter turns and keep the better pass.
        for (extra in intArrayOf(90, 270)) {
          val p = pass(bitmap, exifDegrees, extra)
          if (isBetter(p, best)) best = p
        }
      }
      return mapOf(
        "observations" to best.observations,
        "width" to best.width,
        "height" to best.height,
        "rotation" to best.rotation,
        "ms" to (System.currentTimeMillis() - t0).toInt(),
      )
    } finally {
      bitmap.recycle()
    }
  }

  /**
   * Same rule as iOS: an engine can read glyphs in a frame that is upside down, so text
   * direction decides between passes and mean confidence only breaks ties.
   */
  private fun isBetter(a: Pass, b: Pass): Boolean =
    if (Math.abs(a.forwardFraction - b.forwardFraction) > 0.1) a.forwardFraction > b.forwardFraction
    else a.meanConfidence > b.meanConfidence

  private fun pass(bitmap: Bitmap, exifDegrees: Int, extra: Int): Pass {
    val degrees = (exifDegrees + extra) % 360
    // ML Kit reports boxes in the frame rotated clockwise by `degrees` (upright for this pass).
    val quarter = degrees == 90 || degrees == 270
    val width = if (quarter) bitmap.height else bitmap.width
    val height = if (quarter) bitmap.width else bitmap.height
    val text = Tasks.await(client().process(InputImage.fromBitmap(bitmap, degrees)))

    val observations = mutableListOf<Map<String, Any>>()
    var tall = 0
    var confSum = 0.0
    var directional = 0
    var forward = 0
    for (block in text.textBlocks) {
      for (line in block.lines) {
        val r = line.boundingBox ?: continue
        if (line.text.isBlank()) continue
        if (r.height() > r.width()) tall++
        val first = line.elements.firstOrNull()?.boundingBox
        val last = line.elements.lastOrNull()?.boundingBox
        if (line.elements.size >= 2 && first != null && last != null) {
          directional++
          val dx = last.exactCenterX() - first.exactCenterX()
          val dy = last.exactCenterY() - first.exactCenterY()
          if (dx > Math.abs(dy)) forward++
        }
        val conf = line.confidence.toDouble()
        confSum += conf
        observations.add(
          mapOf(
            "text" to line.text,
            "confidence" to conf,
            "box" to mapOf(
              "x" to r.left.toDouble() / width,
              "y" to r.top.toDouble() / height,
              "w" to r.width().toDouble() / width,
              "h" to r.height().toDouble() / height,
            ),
          )
        )
      }
    }
    val n = observations.size.toDouble()
    return Pass(
      observations,
      if (n > 0) tall / n else 0.0,
      if (n > 0) confSum / n else 0.0,
      if (directional > 0) forward.toDouble() / directional else 0.0,
      width,
      height,
      extra,
    )
  }

  // endregion

  // region dHash

  /**
   * 64-bit difference hash, same algorithm as iOS (see src/ocr/dhash.ts):
   * upright pixels (EXIF applied) scaled to a 256 px long side → luma (299R + 587G + 114B) / 1000
   * → mean over a 9×8 grid of integer-bounded cells → bit (r*8+c) = cell(r,c) < cell(r,c+1),
   * packed MSB-first, 16 lowercase hex chars.
   */
  private fun dHash(uri: String): String {
    val raw = decode(uri, 256)
    val scale = 256.0f / maxOf(raw.width, raw.height)
    val m = Matrix()
    when (exifOrientation(uri)) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> m.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.setScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> { m.setRotate(90f); m.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_ROTATE_90 -> m.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> { m.setRotate(-90f); m.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_ROTATE_270 -> m.setRotate(-90f)
    }
    if (scale < 1f) m.postScale(scale, scale)
    val img = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, m, true)
    if (img !== raw) raw.recycle()
    try {
      val w = img.width
      val h = img.height
      if (w < 9 || h < 8) throw CodedException("ERR_OCR", "Image too small to hash", null)
      val px = IntArray(w * h)
      img.getPixels(px, 0, w, 0, 0, w, h)

      val grid = DoubleArray(9 * 8)
      for (r in 0 until 8) {
        val y0 = r * h / 8
        val y1 = (r + 1) * h / 8
        for (c in 0 until 9) {
          val x0 = c * w / 9
          val x1 = (c + 1) * w / 9
          var sum = 0L
          for (y in y0 until y1) {
            for (x in x0 until x1) {
              val p = px[y * w + x]
              sum += (299 * ((p shr 16) and 0xff) + 587 * ((p shr 8) and 0xff) + 114 * (p and 0xff)) / 1000
            }
          }
          grid[r * 9 + c] = sum.toDouble() / ((y1 - y0) * (x1 - x0))
        }
      }
      var hash = 0UL
      for (r in 0 until 8) {
        for (c in 0 until 8) {
          hash = hash shl 1
          if (grid[r * 9 + c] < grid[r * 9 + c + 1]) hash = hash or 1UL
        }
      }
      return hash.toString(16).padStart(16, '0')
    } finally {
      img.recycle()
    }
  }

  // endregion
}
