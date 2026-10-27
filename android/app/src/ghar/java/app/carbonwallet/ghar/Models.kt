package app.carbonwallet.ghar

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Shapes of the website's household API responses (only the fields the app shows).

/** GET /api/households/{id}/overview */
@Serializable
data class Overview(
    val allowance: Allowance? = null,
    val access: Access = Access(),
    val period: Period? = null,
    val household: Household? = null,
    val kpi: Kpi? = null,
    val trendHistory: List<TrendPoint> = emptyList(),
    val categoryBreakdown: Map<String, Double> = emptyMap(),
    val nextBestAction: SavingAction? = null,
    val members: List<MemberLite> = emptyList(),
)

@Serializable
data class Allowance(val perPersonKg: Double = 0.0, val allowanceKg: Double = 0.0, val month: String? = null, val homes: Int? = null, val source: String? = null)

@Serializable
data class Access(val role: String = "VIEWER", val viewOnly: Boolean = true, val canAddBills: Boolean = false)

@Serializable
data class Period(
    val month: String? = null,
    val label: String? = null,
    val isPartial: Boolean = false,
    val currentMonth: String? = null,
    val soFar: SoFar? = null,
    val newerPartial: NewerPartial? = null,
    val hasData: Boolean = false,
)

@Serializable
data class SoFar(val month: String? = null, val totalKg: Double = 0.0)

@Serializable
data class NewerPartial(val month: String? = null, val label: String? = null, val totalKg: Double = 0.0, val billedDays: Int? = null, val daysInMonth: Int? = null)

@Serializable
data class Household(
    val id: String,
    val name: String = "",
    val city: String = "",
    val state: String = "",
    val size: Int = 1,
    val joinCode: String? = null,
)

@Serializable
data class Kpi(
    val totalEmissions: Double = 0.0,
    val priorEmissions: Double? = null,
    val trendPct: Double? = null,
    val score: Int? = null,
    val scoreBand: String? = null,
    val topContributor: TopContributor? = null,
    val peer: Peer? = null,
    val actionableSavingsKg: Double? = null,
    val actionableSavingsInr: Double? = null,
)

@Serializable
data class TopContributor(val category: String = "", val amountKg: Double = 0.0, val sharePct: Double = 0.0)

@Serializable
data class Peer(val percentile: Int? = null, val cohortCount: Int? = null, val medianKg: Double? = null, val differenceFromMedianPct: Double? = null)

@Serializable
data class TrendPoint(val month: String = "", val label: String = "", val totalKg: Double = 0.0, val partial: Boolean = false, val isReporting: Boolean = false)

@Serializable
data class SavingAction(
    val id: String,
    val action: String = "",
    val description: String = "",
    val category: String = "",
    val kgSaved: Double = 0.0,
    val inrSaved: Double = 0.0,
    val difficulty: String = "",
    val status: String = "",
)

@Serializable
data class MemberLite(val id: String, val name: String = "", val role: String = "")

/** GET /api/households/{id}/bills */
@Serializable
data class BillsResponse(val bills: List<Bill> = emptyList(), val pending: List<BillDocument> = emptyList(), val calibration: Calibration? = null)

@Serializable
data class Bill(
    val id: String,
    val periodStart: String = "",
    val periodEnd: String = "",
    val days: Int = 0,
    val kwh: Double = 0.0,
    val amountInr: Double? = null,
    val discom: String? = null,
    val consumerMasked: String? = null,
    val source: String = "",
    val verified: Boolean = false,
    val kgCo2e: Double = 0.0,
)

@Serializable
data class Calibration(val acKw: Double? = null, val acKwLow: Double? = null, val acKwHigh: Double? = null, val baseloadKwhDay: Double? = null, val nBills: Int = 0)

@Serializable
data class BillDocument(
    val id: String,
    val status: String = "",
    val fileName: String = "",
    val createdAt: String = "",
    val extraction: Extraction? = null,
)

@Serializable
data class Extraction(
    val status: String = "",
    @SerialName("needs_ai") val needsAi: Boolean = false,
    @SerialName("ai_used") val aiUsed: Boolean = false,
    val discom: Discom? = null,
    val fields: Fields? = null,
)

@Serializable
data class Discom(val name: String = "", val state: String = "")

@Serializable
data class Fields(
    @SerialName("units_kwh") val unitsKwh: NumField? = null,
    @SerialName("amount_inr") val amountInr: NumField? = null,
    @SerialName("period_start") val periodStart: TextField? = null,
    @SerialName("period_end") val periodEnd: TextField? = null,
)

@Serializable
data class NumField(val value: Double? = null, val confidence: String = "low")

@Serializable
data class TextField(val value: String? = null, val confidence: String = "low")

@Serializable
data class UploadResponse(val document: BillDocument)

/** GET /api/households/{id}/mohalla */
@Serializable
data class MohallaResponse(
    val month: String? = null,
    val place: String? = null,
    val minHomes: Int = 20,
    val location: Location? = null,
    val mohalla: MohallaInfo? = null,
    val levels: List<Level> = emptyList(),
    val weather: Weather? = null,
    val heat: Heat? = null,
    val feed: List<FeedItem> = emptyList(),
    val facts: Facts? = null,
)

@Serializable
data class Location(val pincode: String? = null, val locality: String? = null, val district: String? = null, val source: String? = null)

@Serializable
data class MohallaInfo(val name: String = "", val homes: Int = 0)

@Serializable
data class Level(
    val level: String = "",
    val name: String = "",
    val nameHi: String? = null,
    val homes: Int? = null,
    val kgPerPerson: Double? = null,
    val prevKgPerPerson: Double? = null,
    val hidden: Boolean = false,
)

@Serializable
data class Weather(val now: WeatherNow? = null, val days: List<WeatherDay> = emptyList(), val air: Air? = null, val source: String? = null)

@Serializable
data class WeatherNow(val tempC: Double? = null, val feelsC: Double? = null, val humidity: Double? = null, val code: Int = 0)

@Serializable
data class WeatherDay(val date: String = "", val maxC: Double? = null, val minC: Double? = null, val rainPct: Double? = null, val code: Int = 0)

@Serializable
data class Air(val pm25: Double? = null, val pm10: Double? = null, val aqi: Int? = null, val band: String? = null)

@Serializable
data class Heat(val maxC: Double? = null, val level: String = "NONE", val extraKg: Double = 0.0, val extraHours: Double = 0.0)

@Serializable
data class FeedItem(val kind: String = "", val title: Bilingual? = null, val en: String = "", val hi: String? = null, val source: String? = null)

@Serializable
data class Bilingual(val en: String = "", val hi: String? = null)

@Serializable
data class Facts(
    val homesWithData: Int = 0,
    val green: Int = 0,
    val shopItems: Int = 0,
    val efficientItems: Int = 0,
    val schemeAsks: Int = 0,
    val schemeApplied: Int = 0,
)

/** GET /api/households/{id}/passbook: the Carbon ID and the card's private barcode */
@Serializable
data class Passbook(
    val carbonId: String? = null,
    val cardCode: String? = null,
    val household: PassbookHousehold? = null,
    val current: PassbookMonth? = null,
    val inProgress: PassbookMonth? = null,
)

@Serializable
data class PassbookHousehold(val name: String = "", val city: String = "", val state: String = "", val size: Int = 1, val issuedOn: String? = null)

@Serializable
data class PassbookMonth(val month: String? = null, val label: String? = null, val totalKg: Double = 0.0, val perPersonKg: Double? = null, val trendPct: Double? = null)

@Serializable
data class AppliancesResponse(val appliances: List<Appliance> = emptyList())

@Serializable
data class Appliance(
    val id: String,
    val name: String = "",
    val type: String = "",
    val rating: String? = null,
    val powerKw: Double? = null,
    val avgHoursPerDay: Double? = null,
    val source: String = "OWNER",
    val brand: String? = null,
    val model: String? = null,
    val purchasedOn: String? = null,
    val capacityTon: Double? = null,
    val annualKwh: Double? = null,
)

@Serializable
data class VehiclesResponse(val vehicles: List<Vehicle> = emptyList())

@Serializable
data class Vehicle(
    val id: String,
    val name: String = "",
    val type: String = "",
    val fuel: String? = null,
    val kmPerUnit: Double? = null,
    val monthlyKm: Double? = null,
    val source: String = "OWNER",
    val registrationNo: String? = null,
)

@Serializable
data class RemovalsResponse(val requests: List<Removal> = emptyList())

@Serializable
data class Removal(
    val id: String,
    val kind: String = "",
    val itemId: String? = null,
    val itemSummary: String = "",
    val shopName: String? = null,
    val reason: String = "",
    val note: String? = null,
    val status: String = "PENDING",
    val decisionNote: String? = null,
    val createdAt: String = "",
    val decidedAt: String? = null,
)

/** GET /api/households/{id}/schemes */
@Serializable
data class SchemesResponse(
    val state: String? = null,
    val forYou: List<Scheme> = emptyList(),
    val all: List<Scheme> = emptyList(),
    val help: List<SchemeHelp> = emptyList(),
)

@Serializable
data class Scheme(
    val slug: String,
    val category: String = "",
    val name: String = "",
    val nameHi: String? = null,
    val summary: String = "",
    val summaryHi: String? = null,
    val benefit: String = "",
    val benefitHi: String? = null,
    val whoQualifies: String? = null,
    val steps: List<String> = emptyList(),
    val documents: List<String> = emptyList(),
    val link: String? = null,
    val helpline: String? = null,
    val status: String = "",
    val reason: String? = null,
    val reasonHi: String? = null,
    val estimateInr: Double? = null,
    val lastChecked: String? = null,
)

@Serializable
data class SchemeHelp(val slug: String = "", val status: String = "", val shop: String? = null, val at: String? = null)
