# IESO Ontario Grid

Live-Zahlen des Stromnetzes von Ontario in Gladys, aus den öffentlichen
Berichten der IESO (Independent Electricity System Operator): der
Echtzeitpreis, der Verbrauch, die Erzeugung nach Energieträger, der CO₂-arme
Anteil und eine geschätzte CO₂-Intensität.

Die Daten sind öffentlich und brauchen kein Konto: mit den echten Berichten
der IESO getestet. Nicht mit der IESO verbunden.

## Was du bekommst

- Ein Gerät **Stromnetz Ontario**: der Zonenpreis von Ontario ($/MWh), der
  Verbrauch von Ontario, die geschätzte CO₂-Intensität, der CO₂-arme und der
  erneuerbare Anteil, der Anteil von Kernkraft, Wasserkraft, Erdgas, Wind,
  Solar, Biobrennstoffen und anderen Quellen, und eine Zusammenfassung in
  einem Satz.
- Drei Szenen-Auslöser: Preis über einer Schwelle, Preis unter einer Schwelle
  (0 für einen negativen Preis), CO₂-armer Anteil über einer Schwelle.
- Ein Dashboard-Widget mit Preis, CO₂-armem Anteil, CO₂, Verbrauch, einer
  24-h-Preiskurve und dem Strommix als Balken.

**Die Preise sind Großhandelspreise** des Echtzeitmarkts der IESO, nicht dein
Stromtarif: Haushalte in Ontario zahlen regulierte Tarife (nach Tageszeit,
gestuft oder Nachttarif) plus Netzentgelt und Global Adjustment. Der
Großhandelspreis zeigt trotzdem, wann Strom reichlich oder knapp ist.

## Voraussetzungen

- Gladys 5.3.0 oder neuer.
- Internetzugang von Gladys aus (die Berichte werden auf
  `reports-public.ieso.ca` gelesen). Kein Konto, kein Schlüssel.

## Installation

In Gladys **Integrationen → Von GitHub installieren**, dann die Adresse des
Repositorys: `https://github.com/guim31/gladys-ieso`.

## Konfiguration

- **Hohe Preisschwelle** und **Niedrige Preisschwelle** ($/MWh): für die
  Preis-Auslöser. Leer: Auslöser aus. Eine niedrige Schwelle von 0 löst aus,
  wenn der Preis negativ wird.
- **Schwelle CO₂-armer Anteil** (%): für den CO₂-arm-Auslöser. Leer: aus.
- **Sprache der Namen**: Namen der Funktionen (beim Hinzufügen des Geräts
  festgelegt), Zusammenfassung und Meldungen der Aktionen. Standard:
  Französisch.

Füge dann im Tab **Entdecken** das Gerät **Stromnetz Ontario** hinzu.

## Geräte

### Stromnetz Ontario

| Funktion                        | Einheit | Aktualisierung |
| ------------------------------- | ------- | -------------- |
| Strompreis Ontario              | $/MWh   | alle 5 Minuten |
| Verbrauch Ontario               | kW      | alle 5 Minuten |
| CO₂-Intensität, geschätzt       | g/kWh   | stündlich      |
| CO₂-armer Anteil                | %       | stündlich      |
| Erneuerbarer Anteil             | %       | stündlich      |
| Anteil jedes Energieträgers (7) | %       | stündlich      |
| Zusammenfassung                 | Text    | alle 5 Minuten |

Gladys hat keine Einheit Megawatt: der Verbrauch ist in kW (17 GW erscheinen
als 17.000.000 kW). Der Preis ist in kanadischen Dollar, mit der
Dollar-Einheit von Gladys angezeigt.

## Szenen

Die Auslöser lösen **einmal pro Überschreitung** aus: Der Wert muss mit einem
Abstand (5 $/MWh, 2 Punkte) zurück über die Schwelle, bevor sie erneut
auslösen. Ein Neustart löst sie nicht erneut aus.

### IESO-Preis über der Schwelle

Der Preis steigt über die hohe Schwelle. Variablen: `price`, `threshold`.

### IESO-Preis unter der Schwelle

Der Preis fällt unter die niedrige Schwelle (0: ein negativer Preis).
Variablen: `price`, `threshold`.

### Netz Ontario: hoher CO₂-armer Anteil

Der CO₂-arme Anteil steigt über seine Schwelle: ein guter Moment, um ein Auto
zu laden oder den Warmwasserbereiter laufen zu lassen. Variablen:
`low_carbon_share`, `renewable_share`, `carbon_intensity`, `threshold`.

## Dashboard

### Widget Stromnetz Ontario

Der Preis (rot über der hohen Schwelle, grün unter der niedrigen oder wenn er
negativ ist), der CO₂-arme Anteil, das CO₂ und der Verbrauch, eine
24-h-Preiskurve, sobald das Gerät hinzugefügt ist, und der Strommix als
Balken. Kurve und Strommix lassen sich jeweils per Einstellung ausblenden.

## Aktionen

### Verbindung zur IESO testen

Liest sofort Preis, Verbrauch und Strommix und antwortet mit den Zahlen oder
mit dem, was fehlgeschlagen ist (in Rot).

## Daten und Grenzen

- Quellen: `RealtimeOntarioZonalPrice` (Zonenpreis von Ontario, alle fünf
  Minuten; er hat mit der Marktreform vom Mai 2025 den HOEP ersetzt),
  `RealtimeTotals` (Verbrauch von Ontario, alle fünf Minuten) und
  `GenOutputCapability` (stündliche Erzeugung jedes Kraftwerks, etwa eine
  Viertelstunde nach der Stunde veröffentlicht). Nur die aktuellen Dateien
  werden gelesen, nie der Verzeichnisindex.
- Takt: Preis und Verbrauch alle fünf Minuten, die Kraftwerke einmal pro
  neuer Stunde (alle zehn Minuten erneut versucht, bis sie da ist). Nichts
  wird gelesen, solange das Gerät nicht hinzugefügt, keine Schwelle gesetzt
  und das Widget auf keinem Dashboard ist.
- Der Strommix umfasst die **ans Übertragungsnetz angeschlossenen**
  Kraftwerke: Importe und kleine Anlagen an den lokalen Netzen (die meisten
  Solardächer) sind nicht enthalten.
- Die CO₂-Intensität ist eine **Schätzung** aus dem Strommix, mit den
  Median-Lebenszyklusfaktoren (IPCC 2014): Kernkraft 12, Wasserkraft 24, Wind
  11, Solar 45, Biobrennstoffe 230, Gas 490, andere 700 g/kWh.
- Der Markt der IESO läuft das ganze Jahr in Eastern Standard Time: die
  Integration rechnet um, auch in der Sommerzeit.
- Eine Zahl, die älter als 30 Minuten (Preis, Verbrauch) oder 3 Stunden
  (Strommix) ist, wird nicht veröffentlicht: lieber kein Wert als ein
  veralteter. Ein unveränderter Wert wird alle 6 Stunden erneut gesendet.
- Die öffentlichen Berichte brauchen keinen Schlüssel, und die IESO nennt
  kein Abfragelimit: sie werden trotzdem nur im Takt ihrer Veröffentlichung
  gelesen, mit einem ehrlichen User-Agent.

## Fehlerbehebung

- **Status „nicht lesbar“** in der Konfiguration: Die Berichte der IESO sind
  nicht erreichbar oder in Wartung. Die Integration versucht es von selbst
  erneut.
- **Kein Wert am Gerät**: Füge das Gerät im Tab Entdecken hinzu, warte dann
  eine Minute oder starte die Testaktion.
- **Logs**: eine Zeile, wenn eine Störung beginnt, und eine, wenn sie endet.
  Für Details setze `LOG_LEVEL=debug`.

## Danksagung

Daten: [IESO](https://www.ieso.ca/power-data), öffentliche Berichte.
Emissionsfaktoren: IPCC AR5 (2014), wie bei Electricity Maps. Integration von
guim31, nicht mit der IESO verbunden.
