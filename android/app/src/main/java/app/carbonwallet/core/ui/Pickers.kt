package app.carbonwallet.core.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.carbonwallet.core.ui.theme.Cw
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** A date shown like "30 Sep 2026" that opens a calendar. [value] is "yyyy-MM-dd" or blank. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, note: String? = null) {
    var open by remember { mutableStateOf(false) }
    Column(modifier) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .background(Color.White, RoundedCornerShape(3.dp))
                .border(1.dp, Cw.border, RoundedCornerShape(3.dp))
                .clickable { open = true }
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.Clock, null, tint = Cw.inkMuted, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
                Text(if (value.isBlank()) t("Pick a date", "तारीख़ चुनें") else date(value), style = MaterialTheme.typography.bodyLarge)
            }
            if (note != null) Text(note, style = MaterialTheme.typography.labelSmall, color = Cw.inkMuted)
        }
    }
    if (open) {
        val initial = runCatching { LocalDate.parse(value).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull()
        val state = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                    open = false
                }) { Text(t("OK", "ठीक है"), color = Cw.ink) }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text(t("Cancel", "रद्द करें"), color = Cw.inkMuted) } },
            colors = DatePickerDefaults.colors(containerColor = Cw.card),
        ) {
            DatePicker(
                state,
                colors = DatePickerDefaults.colors(
                    containerColor = Cw.card,
                    selectedDayContainerColor = Cw.govNavy,
                    todayDateBorderColor = Cw.saffron,
                    todayContentColor = Cw.ink,
                ),
            )
        }
    }
}

/** Big tappable chips for one choice out of a few (reasons, statuses). */
@Composable
fun <T> ChoiceChips(options: List<Pair<String, T>>, selected: T?, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.FlowRow(
        modifier.fillMaxWidth(),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { (label, value) ->
            val on = value == selected
            Text(
                label,
                modifier = Modifier
                    .background(if (on) Cw.govNavy else Cw.card, RoundedCornerShape(3.dp))
                    .border(1.dp, if (on) Cw.govNavy else Cw.border, RoundedCornerShape(3.dp))
                    .clickable { onSelect(value) }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                color = if (on) Color.White else Cw.ink,
                style = MaterialTheme.typography.labelLarge,
            )
        }
    }
}
