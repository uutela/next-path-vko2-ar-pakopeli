# looppi-loki.md — yksi lohko per kierros

Tämä tiedosto on sinua varten. Ei perusteluja, ei tarinaa: mitä tehtiin,
mitkä numerot mitattiin, meneekö läpi. Pitkät selitykset ovat `prompts2.md`:ssä
ja commit-viesteissä.

Lue tämä, tai `git log --oneline` — yksi rivi per kierros.

| # | Prio | Tehtävä | Testit | tsc | Selain | Verdict |
|---|---|---|---|---|---|---|
| 1 | 1 | Pari-speksi (27 kriteeriä, ei koodia) | 133 | 0 | – ei koske selainta | APPROVED |
| 2 | 2 | Syötekatto 2 → 6 | 135 | 0 | 14/14 | APPROVED |
| – | – | Korjaus: selainajot osuivat vko1-repoon | 135 | 0 | 14/14 | korjattu |
| 3 | 3 | Rooli ja pari pisteeseen | 141 | 0 | 14/14 | APPROVED |
| 4 | 4 | Pari siemeneen, `withCompletePairs` kytketty | 143 | 0 | 14/14 | APPROVED |
| 5 | 5 | `Puzzle` → `{ text, answer }`, adapterin taakse | 145 | 0 | 14/14 | APPROVED |
| 6 | 6 | 1–6 numeron sopimus lähteen rajalla | 149 | 0 | 14/14 | APPROVED |
| – | – | Smoke kieltäytyy mittaamasta väärää projektia | 149 | 0 | vartija exit 1 | korjattu |
| 7 | 7–14 | Pari-mekaniikka kokonaan: tilakone, kartta, pulmaruutu, AR-vastaus, selainkävely | **158** | 0 | **19/19** | APPROVED |

**Jäljellä:** prio 15 (toinen pari), 16 (paneelin testit), 17 (speksit kiinni).

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
