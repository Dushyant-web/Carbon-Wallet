# kotlinx.serialization, OkHttp, Coil, CameraX and ML Kit ship their own R8 rules.

# Credential Manager finds its Play Services provider by reflection.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }

# Keep line numbers so crash reports point at real code.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
