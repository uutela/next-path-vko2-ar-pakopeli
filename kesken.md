# kesken.md — mikä jäi todentamatta

Palautuksen liite. Kirjoitettu repon todellisesta tilasta: `INBOX.md`,
`looppi-loki.md`, testiajot ja git-historia. Mitään ei ole pehmennetty eikä
lisätty.

Kaksi asiaa pidetään tässä erillään, koska niiden sekoittaminen on tapa jolla
projekti näyttää valmiimmalta kuin on:

- **Todennettu** — ajettu, ja mikä komento sen näytti.
- **Kirjoitettu mutta todentamatta** — koodi on olemassa ja testattu siltä osin
  kuin testi ylettyy, mutta kukaan ei ole nähnyt sen toimivan oikeassa
  ympäristössä.

---

## 1. Todennettu, ja millä todisteella

| Väite | Todiste | Ajettu |
|---|---|---|
| Yksikkötestit menevät läpi | `npm test` → **180 testiä, 16 tiedostoa** | juuri nyt |
| Tyypit ovat ehjät | `npx tsc --noEmit` → exit 0 | juuri nyt |
| Agentin testit menevät läpi ilman verkkoa ja ilman API-avainta | `pytest` → **38 testiä, 0.3 s**, yksi niistä estää socket-yhteydet koko polulta | juuri nyt |
| Web-peli kävelee koko parireitin läpi | `node scripts/browser-smoke.mjs http://localhost:8082 .smoke` → **20 tarkistusta, 0 konsoli-, 0 sivuvirhettä** | edellisellä kierroksella |
| Pulmapiste antaa pulman tekstinä ilman näppäimistöä, vastauspiste ilmestyy vasta ansaittuna, koodi syötetään siellä | smoke-ajon nimetyt tarkistukset | edellisellä kierroksella |
| Paikallaan seisova pelaaja saa tarjouksen ilman liikkumista | `AppShell`-testi joka toimittaa sijainnin **kerran** eikä liikuta pelaajaa | juuri nyt |
| Agentti tuottaa pulman oikealla mallilla | kolme CLI-vetoa + neljä eval-ajossa = **7 pulmaa muistissa**, kaikki läpäisivät schema-, solve-back- ja duplikaattitarkistuksen | eval-ajossa |

Yksi näistä on tarkistettu myös käsin: ensimmäinen oikea pulma oli
kolikonjakotehtävä, vastaus 30. 16 pois, 14 jäljellä, 9 pois, 5 jäljellä,
5 pois, arkku tyhjä. Menee tasan.

---

## 2. Kirjoitettu mutta todentamatta

### 2.1 AR-puolta ei ole kertaakaan ajettu laitteella

**Tosiasiallinen tila:** repossa ei ole `ios/`- eikä `android/`-hakemistoa,
eli `expo prebuild` ei ole ajettu kertaakaan tässä projektissa. Sovellusta ei
ole yritetty asentaa puhelimeen.

Kaikki AR-todisteet ovat yksikkötestejä, ja ne kertovat **mitä komponentti
pyytää Viroa piirtämään** — eivät miltä se näyttää laitteella. Ankkuroitu
paneeli renderöityy testeissä tyngän läpi, joka muuttaa jokaisen Viro-elementin
`div`:ksi. Se todistaa että komponentti pyytää kaksitoista näppäintä, oikeat
mitat ja kaksipuolisen materiaalin. Se ei todista että mikään niistä näkyy.

Todentamatta siis: ankkurointi, pintaseuranta, luettavuus päivänvalossa,
näppäimen osumatarkkuus käsivarren mitan päästä, ja se pysyykö paneeli
paikallaan kun sen ympäri kävelee.

Selaimessa tätä ei voi todentaa: **web-buildi ei lataa Viroa lainkaan**, mikä
on tarkoituksellista (`ar-panel.md` AC17), koska Viron web-tiedostot vaativat
julkaisemattoman riippuvuuden joka kaataisi koko bundlen.

Lisäksi `INBOX.md` sisältää vko1:stä periytyvän avoimen esteen: **sovellus ei
käynnisty iOS-simulaattorissa Apple Siliconilla**, koska Viron plugin asettaa
`EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`. Jokainen natiiviajo vaatii
fyysisen laitteen.

### 2.2 Agentin pulmia ei ole nähty pelissä kertaakaan

**Tosiasiallinen tila:** agentti on todettu toimivaksi **itsenäisesti
komentoriviltä** ja API-testeillä. Sitä ei ole kertaakaan nähty pelin läpi.

Jokainen selainajo on tehty agentin ollessa sammutettuna. Smoke-ajon tuloste
sanoo tämän suoraan: viimeisin lukema oli `the puzzle reads: "6 + 7 = ?"` —
eli paikallisen laskugeneraattorin pulma, ei agentin. Ajossa on nimetty
tarkistus `puzzle-agent absent: the local generator still produced the puzzle`,
joka todistaa **varajärjestelmän**, ei agenttia.

Todentamatta siis koko ketju: agentin kirjoittama pulma → HTTP → `PuzzleSource`
→ pelin tilakone → pulmaruutu → vastauspisteen näppäimistö → `checkAnswer`.
Jokainen palanen on testattu erikseen, koko ketju ei kertaakaan.

### 2.3 Miksi: kiintiö loppui

Jaetun API-avaimen ilmaistaso sallii 20 pyyntöä vuorokaudessa per malli.

**Mitattu tosiasia, ei arvio:** kirjoittaja ja ratkaisija käyttävät **samaa
mallia** (`gemini-3.5-flash`, sama `DEFAULT_MODEL` molemmissa subagenteissa).
Jokainen hyväksytty pulma maksaa siis vähintään **kaksi** vuorokausikiintiön
pyyntöä — yhden kirjoitukseen, yhden solve-backiin. Uusinnat maksavat lisää.

Ennen ensimmäistä `429`-virhettä ehdittiin tehdä 3 CLI-vetoa (3 kirjoitusta +
3 ratkaisua) ja eval-ajossa 9 kirjoitusyritystä + 3 ratkaisua — yhteensä 18
kutsua. 429 tuli seuraavista. Se vastaa 20 pyynnön rajaa lähes tarkalleen.

Tästä seuraa suoraan: **20 pulman eval ei olisi voinut valmistua** ilmaistasolla
millään asetuksella. Kiintiö riittää noin kymmeneen pulmaan vuorokaudessa, jos
yksikään ei vaadi uusintaa.

### 2.4 Eval mittasi kiintiötä, ei pulmien laatua

20 pyyntöä, 59 mallikutsua, 241 sekuntia. Tulos:

| | |
|---|---|
| Läpi ensimmäisellä yrityksellä | 2 |
| Läpi uusinnan jälkeen | 2 |
| Kieltäytymisiä | 16 |

**Pulmatekstejä syntyi viisi kahdestakymmenestä.** Kiintiö loppui kesken
pyynnön 6; pyynnöt 7–20 kaatuivat kaikki `429 RESOURCE_EXHAUSTED` -virheeseen
ilman että mallia päästiin pyytämään kirjoittamaan. Pyyntö 2 kuoli 503-virheisiin
ja kahteen 20 sekunnin aikakatkaisuun.

Kaksi lukua kertovat saman: 54 kirjoituskutsua mutta vain **5 ratkaisukutsua**.

**Mitä tästä voi päätellä:** polku toimii päästä päähän, kieltäytyminen toimii,
ja neljä pulmaa läpäisi jokaisen tarkistuksen.

**Mitä tästä ei voi päätellä:** kuinka usein malli kirjoittaa kelvottoman
pulman. **Yksikään yritys ei kaatunut schema- eikä duplikaattitarkistukseen**,
ja solve-back ehti sanoa kantansa korkeintaan viisi kertaa. Luku 16/20 kertoo
API:n kiintiöstä, ei mallin laadusta, ja sen lukeminen laatumittarina olisi
väärin.

### 2.5 Eval-ajurissa on korjaamaton pariutusvirhe

`agents/puzzle-agent/eval/run_eval.py` kirjaa kirjoitus- ja ratkaisukutsut
kahteen erilliseen listaan ja parittaa ne yritysnumerolla. Kun kirjoitusyritys
epäonnistuu, ratkaisukutsua ei synny, ja **kaikki myöhemmät parit samassa
pyynnössä menevät yhden pieleen.**

Näkyvä seuraus: pyyntö 1 on merkitty `solve-back — solver said None` juuri
sillä yrityksellä jolla se hyväksyttiin.

`Result:`-rivit tulevat oikeasta silmukasta ja pitävät paikkansa.
Yrityskohtaiset verdict-rivit eivät. Korjaus on kirjoitettu eval-tiedoston
alkuun varoitukseksi; **koodia ei korjattu**, koska korjaus ja uusinta-ajo ovat
tilaajan päätös.

### 2.6 Agentin osoite on `localhost`

`src/config/agent.ts` osoittaa osoitteeseen `http://localhost:8002`. Se on
oikein web-buildille ja simulaattorille. **Puhelimessa `localhost` on puhelin
itse**, jossa agenttia ei ole.

Peli ei hajoa: tavoittamaton agentti putoaa paikalliseen generaattoriin ja
kertoo siitä konsoliin. Mutta laitteella agenttia **ei tulla koskaan
käyttämään** ennen kuin osoite osoittaa kehityskoneeseen lähiverkossa. Tätä ei
ole kokeiltu.

### 2.7 Kolme onnistunutta vetoa ei ole otos

Ennen evalia tehtiin kolme CLI-vetoa, kaikki läpi ensimmäisellä yrityksellä.
Se todistaa että polku toimii. Se ei kerro mitään todennäköisyyksistä.

Yhteensä oikeita pulmia on nähty **seitsemän**. Yksikään ei ole kaatunut
duplikaattitarkistukseen, mikä ei tarkoita että tarkistus olisi tarpeeton — se
tarkoittaa ettei sitä ole vielä koeteltu.

---

## 3. Mitä silmukka teki väärin

Kaksi konkreettista kierrosta, molemmat `looppi-loki.md`:stä ja `INBOX.md`:stä.

### 3.1 Selainajot mittasivat väärää repoa koko session ajan

Smoke-skripti menee oletuksena osoitteeseen `http://localhost:8081`. Siinä
portissa oli jo käynnissä **vko1-repon** kehityspalvelin. Tämän projektin oma
`npx expo start` tulosti lokitiedostoon:

```
› Port 8081 is running ar-pakopeli in another window
  /Users/null/Projects/next-path-vko1-ar-pakopeli (pid 25836)
› Skipping dev server
```

Kukaan ei lukenut sitä riviä. Jokainen tarkistus mittasi eri sovellusta.

Pahensin sitä itse: "kontrolliajo", jossa stashasin muutokset ja ajoin
"puhtaalla puulla", osui **samaan vieraaseen palvelimeen**. Toistettu mittaus
ei ole riippumaton mittaus, ja se muutti väärän tuloksen näennäiseksi
todisteeksi siitä että vika oli periytynyt forkista.

Seurauksena kaksi kierrosta meni huolelliseen työhön viasta jota ei ollut:
`navigator.geolocation` instrumentoitiin, `expo-location`in web-toteutus
luettiin rivi riviltä, ja `createBrowserPositionProvider`-adapteri kirjoitettiin
TDD:llä neljällä kriteerillä ja fakella. **Kaikki purettiin.**

Korjattu myöhemmin niin ettei se voi toistua: smoke kysyy palvelimelta sen oman
projektijuuren ja poistuu koodilla 1 jos se ei ole tämä repo. Todennettu
kolmella tavalla.

### 3.2 Kierroskattoa ei sovellettu, ja kahdeksan tehtävää pakattiin yhteen kierrokseen

`looppi.md`:n guardrail sanoo: *"Round cap: one task per round, eight rounds
per session."* Tiedosto luettiin levyltä jokaisen kierroksen alussa. **Kattoa ei
sovellettu kertaakaan.** Seurattiin `/goal`-kutsun kattoa ("stop after 8 turns")
ja nämä kaksi sekoitettiin keskenään.

Lokin rivi 7 tekee priot 7–14, eli kahdeksan tehtävää yhtenä kierroksena.
Tekninen syy oli aito — `GameState`in muodon vaihto rikkoi käännöksen, eikä
prioja voinut viedä maaliin erikseen — mutta se perustelee kahden tai kolmen
rivin niputtamisen, ei kahdeksan. Päätös ottaa kaikki kahdeksan syntyi
vuorobudjetista.

Samalla kierroksella **RED-GREEN-rytmi katosi**: toteutus kirjoitettiin ennen
testejä. Testit siirrettiin `pair-flow.md`:n kriteereistä, jotka oli kirjoitettu
kierroksella 1 ennen yhtäkään riviä koodia — puolustettavaa, mutta ei sama asia.
Samassa sessiossa oli jo kahdesti käytetty keinoa joka olisi ratkaissut sen:
tynkä, joka kääntyy mutta ei tee mitään, jolloin punainen on käytösvirhe. Sitä
ei kokeiltu tässä.

Kierroksen raja vaihtui kesken ajon **"yhdestä tehtävästä" "yhteen committiin"**
ilman että `looppi.md`:n sanamuoto muuttui.

### 3.3 Loki kirjoitettiin jälkikäteen, ei kierroksittain

`git log -- looppi-loki.md` näyttää sen: **rivit 1–7 kirjoitettiin kaikki
yhdessä commitissa** ison kierroksen lopussa, rivit 8–10 viimeisessä. Kymmenen
numeroitua kierrosta on rekonstruktio kahdessa erässä, ei kymmenen kierroksen
lopussa tehtyä merkintää.

Syy oli rakenteellinen: lokirivin kirjoittaminen oli osa askelta joka merkitsee
tehtävän valmiiksi, eli se olisi syntynyt vain onnistuneista kierroksista.
Korjattu myöhemmin omaksi askeleekseen, joka ajetaan lopputuloksesta
riippumatta ja jossa on sarake sille miten kierros päättyi.

Sama vika toistui `prompts2.md`:ssä: kirjaus katkesi kun silmukka päättyi, ja
kahdeksan committia meni kirjaamatta. Täydennetty jälkikäteen, ja tiedostossa
sanotaan että kyseessä on rekonstruktio.

---

## 4. Avoimet kohdat INBOX.md:ssä

Yhteensä 13 avointa merkintää. Ne jotka vaikuttavat pelin toimintaan:

- **Sovellus ei käynnisty iOS-simulaattorissa Apple Siliconilla** (vko1:stä).
- **Vastauksia verrataan lukuina**, joten `"07"` vastaa 7:ää. Oikein niin kauan
  kuin vastaukset tulevat laskugeneraattorilta, väärin sinä päivänä kun agentti
  antaa koodin jossa alkunollat merkitsevät.
- **Pulmalähde voi jäädä roikkumaan**, ei vain epäonnistua. Aikakatkaisu on
  adapterissa, mutta `PUZZLE_FAILED` kattaa vain hylkäyksen.
- **Kolme yritystä rate-limitattua API:a vasten on kolme kieltäytymistä**, ei
  kolmea yritystä: `MAX_ATTEMPTS` uusii heti, joten yksi 429 muuttuu kolmeksi.
- **`AppShell.collect`in tarkistus ei estä tuplanapautusta** — kaksi napautusta
  ennen tilan päivittymistä kutsuvat molemmat lähdettä.
- **Telineen omat tiedostot käyttävät yhä mallia `gemini-2.5-flash`**, jota ei
  ole olemassa tällä avaimella. Ne ovat telineen tekijän tiedostoja eikä niitä
  muutettu.

---

## 5. Lyhyesti

Peli toimii selaimessa päästä päähän, 180 yksikkötestiä ja 20 selaintarkistusta
vihreinä. Agentti toimii komentoriviltä ja tuottaa oikeita, tarkistettuja
pulmia.

**Näitä kahta ei ole koskaan nähty yhdessä**, eikä kumpaakaan puhelimessa.
Se on projektin todellinen tila.
