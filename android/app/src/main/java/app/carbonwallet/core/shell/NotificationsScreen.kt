package app.carbonwallet.core.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.model.NotificationItem
import app.carbonwallet.core.model.NotificationsPage
import app.carbonwallet.core.net.Http
import app.carbonwallet.core.net.Store
import app.carbonwallet.core.net.rememberRemote
import app.carbonwallet.core.ui.CwCard
import app.carbonwallet.core.ui.EmptyState
import app.carbonwallet.core.ui.LinkButton
import app.carbonwallet.core.ui.LocalLang
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.core.ui.RemoteList
import app.carbonwallet.core.ui.ago
import app.carbonwallet.core.ui.t
import app.carbonwallet.core.ui.theme.Cw
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

@Composable
fun NotificationsScreen() {
    val remote = rememberRemote("/api/notifications", NotificationsPage.serializer())
    val scope = rememberCoroutineScope()
    val nav = LocalNav.current
    RemoteList(remote) { page ->
        if (page.unread > 0) {
            item(key = "mark") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("${page.unread} unread", "${page.unread} नहीं पढ़ी"), style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                    LinkButton(t("Mark all read", "सब पढ़ी हुई करें"), {
                        scope.launch {
                            runCatching { Http.sendText("POST", "/api/notifications/read", buildJsonObject { put("all", JsonPrimitive(true)) }) }
                                .onSuccess { Store.changed() }
                                .onFailure { nav.toast(it.message ?: "") }
                        }
                    })
                }
            }
        }
        if (page.items.isEmpty()) {
            item { EmptyState(Lucide.Inbox, t("Nothing new", "कुछ नया नहीं"), t("Updates about your account appear here.", "आपके खाते की खबरें यहाँ दिखेंगी।")) }
        }
        items(page.items, key = { it.id }) { NotificationCard(it) }
    }
}

@Composable
private fun NotificationCard(item: NotificationItem) {
    val lang = LocalLang.current
    val icon = when (item.kind) {
        "SHOP" -> Lucide.Store
        "MOHALLA" -> Lucide.MapPin
        "SCHEME" -> Lucide.Landmark
        "REMINDER" -> Lucide.Clock
        "BILL" -> Lucide.Bill
        "HEAT" -> Lucide.Thermometer
        "REMOVAL" -> Lucide.Package
        else -> Lucide.Bell
    }
    CwCard(background = if (item.read) Cw.card else androidx.compose.ui.graphics.Color.White, border = if (item.read) Cw.border else Cw.borderHover) {
        Row(verticalAlignment = Alignment.Top) {
            Box(Modifier.size(36.dp).background(if (item.read) Cw.subtle else Cw.govSky, CircleShape), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = Cw.govNavy, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(item.title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                    if (!item.read) Box(Modifier.padding(start = 6.dp).size(8.dp).background(Cw.terracotta, CircleShape))
                }
                Spacer(Modifier.padding(top = 2.dp))
                Text(item.body, style = MaterialTheme.typography.bodyMedium, color = Cw.inkMuted)
                Text(ago(item.at, lang), style = MaterialTheme.typography.labelSmall, color = Cw.inkLight, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}
