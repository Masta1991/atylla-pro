# Analiza gotowości Atylla Pro – TYLKO Wersja Testowa (Android / Wewnętrzne Testy)

## 1. Stan Aktualny (Co mamy gotowe)
* **Framework:** Kod React Native, który już w 100% działa na środowisku Android.
* **Konfiguracja:** W pp.json mamy ustawiony systemowy package: com.atyllapro.app i ersionCode: 56.
* **Kompilator:** Chmura EAS za pomocą jednej komendy wygeneruje podpisany plik .aab wymagany do dystrybucji z Google Play.

## 2. Co musisz zrobić, aby wgrać apkę do wewnętrznych testów (Minimum)
Google udostępnia specjalny kanał "Internal Testing" (Testy wewnętrzne). Jest to kanał, gdzie **NIE obowiązuje zasada "20 testerów przez 14 dni"** ani rygorystyczne sprawdzanie przez moderatorów i wymuszanie pięknej wizytówki ze screenami. Służy wyłącznie Tobie i zaufanym znajomym.

1. **Założenie Konta Google Play Developer:**
   Musisz opłacić jednorazową licencję dewelopera Google (25 USD na całe życie).
   
2. **Utworzenie pustej aplikacji w Google Play Console:**
   Wchodzisz w Google Play Console, dajesz "Utwórz aplikację", podajesz nazwę ("Atylla Pro"). Sklep zapyta o podstawowe dane, ale **możesz zignorować** dodawanie zrzutów ekranu, bannerów promujących i pełnego opisu.

3. **Wygenerowanie pliku .aab z terminala:**
   Otwierasz terminal w naszym projekcie i wpisujesz komendę:
   \\\ash
   eas build -p android
   \\\
   Podczas pierwszego uruchomienia EAS zapyta, czy chcesz, aby wygenerował nowy klucz zabezpieczający (Keystore) – dajesz "Yes". Po kilkunastu minutach otrzymasz gotowy link do pobrania pliku .aab.

4. **Wrzucenie pliku do Google Play:**
   Wchodzisz w zakładkę "Testowanie" -> "Testy wewnętrzne" i wgrywasz tam wygenerowany plik .aab. 
   Następnie dodajesz do listy testerów swój adres e-mail (adres z konta Google/Gmail).

## 3. Co dalej?
Po dodaniu testerów, Google wygeneruje Ci specjalny link. Jak klikniesz go na swoim telefonie z Androidem, zostaniesz przekierowany do aplikacji Google Play Store, skąd pobierzesz "Atyllę Pro" dokładnie tak samo, jak pobiera się Instagrama czy Facebooka. Będzie działać od razu. Zmiana ikony czy formalności prawne (polityka prywatności) nie będą tu stanowić dużej przeszkody tak długo, jak apka jest "wewnętrzna"!
