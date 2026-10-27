package app.carbonwallet.ghar

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.shell.Nav
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.Eyebrow
import app.carbonwallet.core.ui.HelplineStrip
import app.carbonwallet.core.ui.Lang
import app.carbonwallet.core.ui.ListRow
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.PortalBand
import app.carbonwallet.core.ui.PrimaryButton
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.SectionHeader
import app.carbonwallet.core.ui.StatusPill
import app.carbonwallet.core.ui.Tag
import app.carbonwallet.core.ui.Tone
import app.carbonwallet.core.ui.date
import app.carbonwallet.core.ui.pick
import app.carbonwallet.core.ui.rupees
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw

@Composable
fun YojanaTab(nav: Nav) = WithHome { home ->
    val remote = rememberRemote(homePath(home.id, "schemes"), SchemesResponse.serializer())
    val lang = LocalLang.current

    RemoteList(remote, contentPadding = PaddingValues(bottom = 28.dp)) { s ->
        item(key = "band") {
            PortalBand(t("Govt schemes", "सरकारी योजना"), t("Subsidies and free help your home can get", "सब्सिडी और मुफ़्त मदद जो आपके घर को मिल सकती है"))
        }

        if (s.forYou.isNotEmpty()) {
            item(key = "forYouTitle") {
                SectionHeader(t("For your home", "आपके घर के लिए"), t("Matched from your bills and items", "आपके बिल और सामान से मिलाई गई"), Modifier.padding(horizontal = 16.dp))
            }
            items(s.forYou, key = { "f-" + it.slug }) { scheme ->
                CwCard(Modifier.padding(horizontal = 16.dp), border = Cw.saffron.copy(alpha = 0.5f), onClick = { openScheme(nav, scheme) }) {
                    Row(verticalAlignment = Alignment.Top) {
                        SchemeBadge(scheme.category)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(lang.pick(scheme.name, scheme.nameHi), style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(2.dp))
                            Text(lang.pick(scheme.reason ?: scheme.summary, scheme.reasonHi ?: scheme.summaryHi), style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted)
                        }
                    }
                    scheme.estimateInr?.let {
                        Spacer(Modifier.height(12.dp))
                        Row(
                            Modifier.fillMaxWidth().background(Cw.successSoft).padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(t("You could get about", "आपको लगभग मिल सकता है"), style = MaterialTheme.typography.bodySmall, color = Cw.successText, modifier = Modifier.weight(1f))
                            Text(rupees(it), style = MaterialTheme.typography.headlineSmall, color = Cw.successText)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(t("How to claim →", "कैसे लें →"), color = Cw.govBlue, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        if (s.help.isNotEmpty()) {
            item(key = "help") {
                CwCard(Modifier.padding(horizontal = 16.dp), background = Cw.govSky, border = Cw.govSky) {
                    Eyebrow(t("Help from shops", "दुकानों से मदद"), color = Cw.govNavy)
                    s.help.forEach { h ->
                        val name = s.all.firstOrNull { it.slug == h.slug }?.let { lang.pick(it.name, it.nameHi) } ?: h.slug
                        Text(
                            if (h.status == "APPLIED") t("${h.shop ?: "A shop"} helped you apply for $name", "${h.shop ?: "एक दुकान"} ने $name के आवेदन में मदद की")
                            else t("${h.shop ?: "A shop"} explained $name", "${h.shop ?: "एक दुकान"} ने $name समझाई"),
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                }
            }
        }

        val others = s.all.filter { a -> s.forYou.none { it.slug == a.slug } }
        if (others.isNotEmpty()) {
            item(key = "allTitle") { SectionHeader(t("All schemes", "सभी योजनाएँ"), modifier = Modifier.padding(horizontal = 16.dp)) }
            items(others, key = { "a-" + it.slug }) { scheme ->
                CwCard(Modifier.padding(horizontal = 16.dp), padding = 12.dp) {
                    ListRow(
                        lang.pick(scheme.name, scheme.nameHi),
                        subtitle = lang.pick(scheme.summary, scheme.summaryHi),
                        icon = categoryIcon(scheme.category),
                        iconBg = Cw.saffronSoft,
                        iconTint = Cw.warningText,
                        onClick = { openScheme(nav, scheme) },
                    )
                }
            }
        }

        item(key = "note") {
            Text(
                t(
                    "Scheme details are checked by Carbon Wallet staff, but rules change. Always confirm on the official website or helpline before you pay anyone.",
                    "योजनाओं की जानकारी Carbon Wallet टीम जाँचती है, पर नियम बदलते रहते हैं। किसी को पैसे देने से पहले सरकारी वेबसाइट या हेल्पलाइन पर ज़रूर पुष्टि करें।",
                ),
                style = MaterialTheme.typography.bodySmall,
                color = Cw.inkMuted,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
    }
}

private fun openScheme(nav: Nav, scheme: Scheme) {
    nav.push(scheme.name, scheme.nameHi ?: scheme.name) { SchemeDetail(scheme) }
}

@Composable
private fun SchemeDetail(scheme: Scheme) {
    val lang = LocalLang.current
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SchemeBadge(scheme.category)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(lang.pick(scheme.name, scheme.nameHi), style = MaterialTheme.typography.headlineSmall)
                if (scheme.status == "CHECK") StatusPill(Tone.WARN, t("Details being re-checked", "जानकारी दोबारा जाँची जा रही है"))
            }
        }
        Text(lang.pick(scheme.summary, scheme.summaryHi), style = MaterialTheme.typography.bodyLarge)

        CwCard(background = Cw.successSoft, border = Cw.successBorder) {
            Eyebrow(t("What you get", "क्या मिलेगा"), color = Cw.successText)
            Spacer(Modifier.height(4.dp))
            Text(lang.pick(scheme.benefit, scheme.benefitHi), style = MaterialTheme.typography.bodyMedium)
            scheme.estimateInr?.let {
                Spacer(Modifier.height(8.dp))
                Text(t("For your home: about ${rupees(it)}", "आपके घर के लिए: लगभग ${rupees(it)}"), style = MaterialTheme.typography.titleMedium, color = Cw.successText)
            }
        }

        scheme.whoQualifies?.takeIf { it.isNotBlank() }?.let {
            CwCard {
                Eyebrow(t("Who can get it", "किसे मिलेगा"))
                Spacer(Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
        }

        if (scheme.steps.isNotEmpty()) {
            CwCard {
                Eyebrow(t("How to claim", "कैसे लें"))
                Spacer(Modifier.height(8.dp))
                scheme.steps.forEachIndexed { i, step ->
                    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
                        Box(Modifier.size(26.dp).background(Cw.govNavy, CircleShape), contentAlignment = Alignment.Center) {
                            Text("${i + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(step, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(top = 3.dp))
                    }
                }
            }
        }

        if (scheme.documents.isNotEmpty()) {
            CwCard {
                Eyebrow(t("Keep these ready", "ये काग़ज़ तैयार रखें"))
                Spacer(Modifier.height(6.dp))
                scheme.documents.forEach { doc ->
                    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Lucide.FileCheck, null, tint = Cw.moss, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(doc, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        scheme.helpline?.takeIf { it.isNotBlank() }?.let { number ->
            HelplineStrip(number, t("Official helpline", "सरकारी हेल्पलाइन")) {
                context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
            }
        }
        scheme.link?.takeIf { it.startsWith("https://") }?.let { link ->
            PrimaryButton(t("Open the official website", "सरकारी वेबसाइट खोलें"), {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)))
            }, Modifier.fillMaxWidth(), icon = Lucide.External, color = Cw.govNavy)
            Text(Uri.parse(link).host ?: link, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
        }
        scheme.lastChecked?.let {
            Tag(t("Last checked ${date(it)}", "आख़िरी जाँच ${date(it)}"))
        }
        if (lang == Lang.HI && scheme.steps.isNotEmpty()) {
            Text("कदम और काग़ज़ों की सूची अभी अंग्रेज़ी में है।", style = MaterialTheme.typography.bodySmall, color = Cw.inkMuted)
        }
    }
}

@Composable
private fun SchemeBadge(category: String) {
    Box(Modifier.size(44.dp).background(Cw.saffronSoft, CircleShape), contentAlignment = Alignment.Center) {
        Icon(categoryIcon(category), null, tint = Cw.warningText, modifier = Modifier.size(22.dp))
    }
}

private fun categoryIcon(category: String): ImageVector = when (category.uppercase()) {
    "SOLAR" -> Lucide.Sun
    "EFFICIENT" -> Lucide.Zap
    "EV", "TRANSPORT" -> Lucide.Car
    "COOKING", "LPG" -> Lucide.Leaf
    "WATER" -> Lucide.Droplets
    else -> Lucide.Landmark
}
