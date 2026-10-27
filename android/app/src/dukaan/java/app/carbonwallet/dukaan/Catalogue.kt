package app.carbonwallet.dukaan

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.LocalNav
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.Banner
import app.carbonwallet.core.ui.CardShape
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.CwTextField
import app.carbonwallet.core.ui.DateField
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.InfoRow
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.kg
import app.carbonwallet.core.ui.kgNumber
import app.carbonwallet.core.ui.rupees
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import java.time.LocalDate

@Composable
fun efficiencyTag(efficiency: String?) {
    when (efficiency?.uppercase()) {
        "BEST", "EXCELLENT" -> Tag(t("Saves the most", "सबसे ज़्यादा बचत"), color = Cw.successText, background = Cw.successSoft)
        "GOOD" -> Tag(t("Good", "अच्छा"), color = Cw.successText, background = Cw.successSoft)
        "OK", "AVERAGE" -> Tag(t("Average", "औसत"), color = Cw.warningText, background = Cw.warningSoft)
        "POOR" -> Tag(t("Costly to run", "चलाना महँगा"), color = Cw.criticalText, background = Cw.criticalSoft)
        null -> Unit
        else -> Tag(efficiency)
    }
}

@Composable
private fun ProductImage(item: CatalogueItem, modifier: Modifier) {
    Box(modifier.clip(CardShape).background(Cw.subtle), contentAlignment = Alignment.Center) {
        Icon(if (item.kind == "VEHICLE") Lucide.Car else Lucide.Package, null, tint = Cw.inkLight, modifier = Modifier.size(28.dp))
        item.imageUrl?.let { AsyncImage(Http.url(it), item.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
    }
}

@Composable
private fun ProductRow(item: CatalogueItem, onClick: (() -> Unit)?) {
    CwCard(padding = 12.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.Top) {
            ProductImage(item, Modifier.size(76.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(
                    listOfNotNull(item.priceInr?.let { rupees(it) }, item.stars?.takeIf { it > 0 }?.let { "$it★" }, item.sku).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = Cw.inkMuted,
                )
                item.facts?.let { f ->
                    Text(
                        listOfNotNull(
                            f.yearlyRupees?.let { t("${rupees(it)} a year to run", "चलाने का ${rupees(it)} सालाना") },
                            f.yearlyKg?.let { "${kg(it)} CO₂e" },
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    efficiencyTag(item.facts?.efficiency)
                    if (item.inverter) Tag(t("Inverter", "इन्वर्टर"))
                    if (item.sold > 0) Tag(t("${item.sold} sold", "${item.sold} बिके"))
                }
            }
        }
    }
}

/** Step 2 at the counter: choose what the customer bought from the shop's own catalogue. */
@Composable
fun CataloguePicker(scan: ScanResult) {
    val remote = rememberRemote("/api/merchant/catalogue", CatalogueResponse.serializer())
    val nav = LocalNav.current
    var query by rememberSaveable { mutableStateOf("") }
    RemoteList(remote) { data ->
        item(key = "search") {
            CwTextField(query, { query = it }, t("Search brand, model or type", "ब्रांड, मॉडल या प्रकार खोजें"), icon = Lucide.Search)
        }
        val q = query.trim().lowercase()
        val shown = data.items.filter { it.active && (q.isEmpty() || "${it.title} ${it.brand} ${it.model} ${it.type} ${it.sku}".lowercase().contains(q)) }
        if (shown.isEmpty()) item { EmptyState(Lucide.Package, t("Nothing matches", "कुछ नहीं मिला"), t("Add products to your catalogue on the website.", "वेबसाइट पर अपने कैटलॉग में सामान जोड़ें।")) }
        items(shown, key = { it.id }) { product ->
            ProductRow(product) { nav.push("Register the item", "सामान दर्ज करें") { RegisterItem(scan, product) } }
        }
    }
}

/** Step 3: only what is unique to this unit (serial or chassis number, invoice, date); the label facts come from the catalogue. */
@Composable
private fun RegisterItem(scan: ScanResult, product: CatalogueItem) {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val vehicle = product.kind == "VEHICLE"
    var serial by rememberSaveable { mutableStateOf("") }
    var registration by rememberSaveable { mutableStateOf("") }
    var invoice by rememberSaveable { mutableStateOf("") }
    var purchased by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ProductRow(product, null)
        CwCard(background = Cw.govSky, border = Cw.govSky) {
            Eyebrow(t("Registering to", "इनके नाम दर्ज"), color = Cw.govNavy)
            Text(scan.customer.name, style = MaterialTheme.typography.titleMedium)
            scan.customer.carbonId?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted) }
        }
        error?.let { Banner(Tone.BAD, it) }
        if (vehicle) {
            CwTextField(serial, { serial = it.uppercase().filter { c -> c.isLetterOrDigit() }.take(17) }, t("Chassis number (VIN)", "चेसिस नंबर (VIN)"), icon = Lucide.Car,
                supporting = t("11–17 letters and digits, without I, O or Q", "11–17 अक्षर और अंक, I, O, Q के बिना"))
            CwTextField(registration, { registration = it.uppercase().take(15) }, t("Registration number (if issued)", "रजिस्ट्रेशन नंबर (अगर मिला हो)"), icon = Lucide.Tag)
        } else {
            CwTextField(serial, { serial = it.take(60) }, t("Serial number (on the box or label)", "सीरियल नंबर (डिब्बे या लेबल पर)"), icon = Lucide.Tag)
        }
        CwTextField(invoice, { invoice = it.take(40) }, t("Invoice number (optional)", "बिल नंबर (ज़रूरी नहीं)"), icon = Lucide.Receipt)
        DateField(t("Bought on", "ख़रीद की तारीख़"), purchased, { purchased = it })

        PrimaryButton(t("Register to this home", "इस घर के नाम दर्ज करें"), {
            if (serial.trim().length < 3) {
                error = if (vehicle) "Enter the chassis number." else "Enter the serial number."
                return@PrimaryButton
            }
            busy = true
            error = null
            scope.launch {
                try {
                    val res = Http.send("POST", "/api/merchant/sales", buildJsonObject {
                        put("ticket", scan.ticket)
                        put("catalogueItemId", product.id)
                        putJsonObject("item") {
                            if (vehicle) {
                                put("vin", serial.trim())
                                registration.trim().takeIf { it.isNotEmpty() }?.let { put("registrationNo", it) }
                            } else {
                                put("serialNo", serial.trim())
                            }
                            invoice.trim().takeIf { it.isNotEmpty() }?.let { put("invoiceRef", it) }
                            put("purchasedOn", purchased)
                        }
                    }, SaleCreated.serializer())
                    CounterSession.registered.add(res.sale.summary.ifBlank { product.title })
                    Store.changed()
                    nav.pop()
                    nav.pop()
                    nav.toast("Registered. The family gets a notification.")
                } catch (e: Exception) {
                    error = e.message
                }
                busy = false
            }
        }, Modifier.fillMaxWidth(), icon = Lucide.Check, busy = busy, color = Cw.moss)
        Text(
            t("If the family says it isn't theirs, an admin reviews it and it counts against the shop.", "अगर परिवार कहे कि यह उनका नहीं है, तो एडमिन जाँच करेंगे और यह दुकान के ख़िलाफ़ गिना जाएगा।"),
            style = MaterialTheme.typography.bodySmall,
            color = Cw.inkMuted,
        )
    }
}

@Composable
fun CatalogueTab(nav: Nav) {
    val remote = rememberRemote("/api/merchant/catalogue", CatalogueResponse.serializer())
    RemoteList(remote) { data ->
        item(key = "head") {
            Column {
                Eyebrow(t("Catalogue", "कैटलॉग"))
                Text(t("${data.items.count { it.active }} products on sale", "${data.items.count { it.active }} सामान बिक्री पर"), style = MaterialTheme.typography.headlineSmall)
                Text(
                    t("Running cost and CO₂ come from each product's energy label. Add or edit products on the website (CSV upload).", "चलाने का ख़र्च और CO₂ हर सामान के ऊर्जा लेबल से। सामान वेबसाइट पर जोड़ें या बदलें (CSV अपलोड)।"),
                    style = MaterialTheme.typography.bodySmall,
                    color = Cw.inkMuted,
                )
            }
        }
        if (data.items.isEmpty()) item { EmptyState(Lucide.Package, t("No products yet", "अभी कोई सामान नहीं")) }
        items(data.items.sortedByDescending { it.sold }, key = { it.id }) { product ->
            ProductRow(product) { nav.push(product.title, product.title) { ProductDetail(product) } }
        }
    }
}

@Composable
private fun ProductDetail(p: CatalogueItem) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ProductImage(p, Modifier.fillMaxWidth().aspectRatio(4f / 3f))
        Text(p.title, style = MaterialTheme.typography.headlineSmall)
        p.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted) }
        CwCard {
            InfoRow(t("Price", "दाम"), rupees(p.priceInr))
            InfoRow(t("Brand · model", "ब्रांड · मॉडल"), "${p.brand} · ${p.model}")
            p.stars?.takeIf { it > 0 }?.let { InfoRow(t("Star label", "स्टार लेबल"), "$it★" + if (p.inverter) " · inverter" else "") }
            p.capacityTon?.let { InfoRow(t("Size", "क्षमता"), "${kgNumber(it)} t") }
            p.fuel?.let { InfoRow(t("Fuel", "ईंधन"), it) }
            p.kmPerUnit?.let { InfoRow(t("Mileage", "माइलेज"), "${kgNumber(it)} km/l") }
            p.warrantyYears?.let { InfoRow(t("Warranty", "वारंटी"), t("$it years", "$it साल")) }
            p.sku?.let { InfoRow("SKU", it) }
        }
        p.facts?.let { f ->
            CwCard(background = Cw.mossSoft, border = Cw.successBorder) {
                Eyebrow(t("A year of use", "एक साल का इस्तेमाल"), color = Cw.successText)
                f.yearlyKwh?.let { InfoRow(t("Electricity", "बिजली"), "${it.toInt()} kWh") }
                f.yearlyRupees?.let { InfoRow(t("Running cost", "चलाने का ख़र्च"), rupees(it)) }
                f.yearlyKg?.let { InfoRow("CO₂e", kg(it)) }
                f.benefitNote?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Cw.successText) }
            }
        }
    }
}
