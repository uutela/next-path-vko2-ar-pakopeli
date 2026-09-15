# looppi-loki.md — yksi lohko per kierros

Tämä tiedosto on sinua varten. Ei perusteluja, ei tarinaa: mitä tehtiin,
mitkä numerot mitattiin, miten kierros päättyi. Pitkät selitykset ovat
`prompts2.md`:ssä ja commit-viesteissä.

**Jokainen kierros kirjaa rivinsä, myös keskeytynyt.** Viimeinen sarake kertoo
lopputuloksen: `DONE`, `CHANGES_REQUIRED`, tai sen guardrailin nimi joka
pysäytti kierroksen. Loki joka kirjaa vain onnistuneet kierrokset on ainoa
laji jota kukaan ei tarvitse.

Lue tämä, tai `git log --oneline` — yksi rivi per kierros.

| # | Prio | Tehtävä | Testit | tsc | Selain | Miten päättyi |
|---|---|---|---|---|---|---|
| 1 | 1 | Pari-speksi (27 kriteeriä, ei koodia) | 133 | 0 | – ei koske selainta | APPROVED |
| 2 | 2 | Syötekatto 2 → 6 | 135 | 0 | 14/14 | APPROVED |
| – | – | Korjaus: selainajot osuivat vko1-repoon | 135 | 0 | 14/14 | korjattu |
| 3 | 3 | Rooli ja pari pisteeseen | 141 | 0 | 14/14 | APPROVED |
| 4 | 4 | Pari siemeneen, `withCompletePairs` kytketty | 143 | 0 | 14/14 | APPROVED |
| 5 | 5 | `Puzzle` → `{ text, answer }`, adapterin taakse | 145 | 0 | 14/14 | APPROVED |
| 6 | 6 | 1–6 numeron sopimus lähteen rajalla | 149 | 0 | 14/14 | APPROVED |
| – | – | Smoke kieltäytyy mittaamasta väärää projektia | 149 | 0 | vartija exit 1 | korjattu |
| 7 | 7–14 | Pari-mekaniikka kokonaan: tilakone, kartta, pulmaruutu, AR-vastaus, selainkävely | **158** | 0 | **19/19** | DONE |
| 8 | 15 | Toinen pari dataan, monen parin kriteerit | 160 | 0 | 19/19 | DONE |
| 9 | 16 | Paneelin testit molempia toteutuksia vasten (31 testiä) | 160 | 0 | 19/19 | DONE — ankkurointia **ei todennettu** |
| 10 | 17 | Speksit kiinni, `game-state.md` merkitty korvatuksi | **163** | 0 | 19/19 | DONE |
| 11 | 18 | Kerätty pulmapiste lakkaa tarjoamasta — ei enää varjosta vastauspistettään | **166** | 0 | 19/19 | DONE |
| 12 | – | Siemenpisteiden nimet vastaamaan sijaintia (nimet olivat väärien paikkojen) | 166 | 0 | 19/19 | DONE |
| 13 | 19 | Kartta avautuu pelaajan sijaintiin, ei ensimmäiseen pisteeseen | **170** | 0 | 19/19 | DONE |

**Kaikki 19 tehtävää valmiit.** 170 testiä, `npx tsc --noEmit` exit 0,
19 selaintarkistusta, 0 konsoli- ja 0 sivuvirhettä — viimeinen ajo paikallisilla
pisteillä, joiden pari on samassa paikassa. Se pari jumitti ennen kierrosta 11.

Selainajo kävelee nyt koko reitin: kaukana → pulmapiste → pulma tekstinä ilman
näppäimistöä → kartalle, jossa vastauspiste on ilmestynyt → vastauspiste →
koodi → onnittelu. 19 tarkistusta, 0 konsoli- ja 0 sivuvirhettä.

**AR-ankkurointia ei ole todennettu eikä voi todentaa selaimessa** — web-buildi
ei lataa Viroa lainkaan. Paneelin yksikkötestit kertovat mitä komponentti pyytää
Viroa piirtämään, eivät miltä se näyttää laitteella. Se vaatii kenttäkierroksen.

## Löydökset (kaikki myös INBOX.md:ssä)

- `saveStoredPoints` kirjoitti eksplisiittisesti neljä kenttää, joten `role` ja
  `pairId` olisivat kadonneet tallennuksessa — kentällä piste olisi vain
  hävinnyt. Korjattu koodista, ei testistä.
- Selainajot mittasivat vko1-repoa koko session ajan. Smoke estää sen nyt itse.
- Prio 4:n oma `Done when` -komento oli väärä: `JSON.stringify(p).includes('answer')`
  ei erota rooliarvoa `"answer"` vastauskentästä.
