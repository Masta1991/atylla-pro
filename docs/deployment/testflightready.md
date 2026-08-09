# Analiza gotowości Atylla Pro – TYLKO TestFlight (Wersja Testowa)

## 1. Stan Aktualny (Co mamy gotowe)
* **Framework:** Aplikacja jest zbudowana w **Expo (React Native)** – natywne środowisko iOS.
* **Konfiguracja:** W pp.json mamy już przypisany unikalny numer undleIdentifier: com.atyllapro.app.
* **Konto Apple Developer:** **POSIADASZ OPŁACONE KONTO** – to kluczowy element!

## 2. Co musisz zrobić, aby wgrać apkę na TestFlight (Minimum)
Masz świetną intuicję – systemy Apple zazwyczaj wymagają ręcznego przeklikiwania identyfikatorów. Jednak dzięki naszemu inteligentnemu środowisku Expo (EAS), **cała biurokracja wykona się sama w terminalu!**

Jedyne co musisz zrobić, to odpalić w konsoli:

\\\ash
cd frontend
npx eas build -p ios --auto-submit
\\\

**Jak to zadziała w tle (Magia EAS):**
1. Skrypt poprosi Cię o zalogowanie na Twoje Apple ID.
2. Zauważy, że nie masz zarejestrowanego Bundle ID i zapyta: *"Would you like to register it?"* - Wpiszesz **Yes**.
3. Zauważy, że nie masz aplikacji w App Store Connect i zapyta: *"Would you like to create it?"* - Wpiszesz **Yes**.
4. Wygeneruje certyfikaty bezpieczeństwa, zbuduje aplikację na serwerach i **automatycznie wyśle ją do Apple!**

## 3. Co dalej?
Dopiero GDY skrypt skończy działać (ok. 20-30 min), zalogujesz się po raz pierwszy do App Store Connect. Zobaczysz tam, że wpis "Atylla Pro" sam się magicznie utworzył.
Wejdziesz tam w zakładkę "TestFlight" -> "Internal Testing", dopiszesz swój e-mail i apka pojawi się na Twoim telefonie.
