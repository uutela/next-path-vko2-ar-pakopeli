# turvallisuus.md — kohtalokas kolmikko, tarkistettuna

Palautuksen liite. Arvio `agents/puzzle-agent`-agentista kurssimateriaalin
kolmen ominaisuuden kehyksellä:

1. **Pääsy yksityiseen dataan** — lukee tiedostoja, tietokantaa, viestejä
2. **Altistuminen epäluotetulle sisällölle** — lukee tekstiä jota ei itse kirjoittanut
3. **Kyky viestiä ulos** — verkkokutsut, tiedostoihin kirjoittaminen

Kaikki alla oleva on luettu koodista tälle tarkistukselle, ei muistista.
Kaksi kohtaa tarkistettiin nimenomaisesti pyynnöstä, ja toinen niistä muutti
lopputuloksen.

---

## 1. Inventaario

| Osa | 1. Yksityinen data | 2. Epäluotettu sisältö | 3. Ulosvientikanava | Mitä se tosiasiassa tekee |
|---|---|---|---|---|
| `agent_env.py` | **kyllä** | ei | ei | Lataa `.env` ja `.env.local` **jokaisesta ylähakemistosta tiedostojärjestelmän juureen asti** |
| `puzzle_core.py` | ei | ei | ei | Puhtaita funktioita. Ei tiedostoja, ei verkkoa, ei `genai`-importtia lainkaan |
| `puzzle_agent.py` | ei | ei | ei | Orkestrointi. Kutsuu coren, muistin ja kaksi subagenttia |
| `subagents/puzzle_writer.py` | ei | ks. §3 | **kyllä** | HTTPS Googlen Gemini-rajapintaan |
| `subagents/puzzle_solver.py` | ei | ks. §3 | **kyllä** | HTTPS samaan rajapintaan |
| `memory/memory.py` | osin | ks. §3 | **kyllä** | Lukee ja kirjoittaa `memory/data/issued_puzzles.json` — vain oman kansionsa sisällä |
| `api/main.py` | ei | **ei** (ks. §2) | ei | `GET /health`, `POST /puzzle`. Kuuntelee `127.0.0.1:8002` |
| `tools/generate_puzzle.py` | ei | ei | ei | Tulostaa JSONin stdoutiin |
| `eval/run_eval.py` | ei | ei | kyllä | Mittausajuri. Kirjoittaa `eval/`-kansioon |

**Mitä agentissa ei ole, tarkistettuna:** ei `subprocess`ia, ei `os.system`ia,
ei `exec`ia eikä `eval`ia, ei `requests`ia, `urllib`ia eikä `httpx`ia. Ainoa
verkkoyhteys on `genai.Client`, kahdessa paikassa. Ainoa kirjoitus levylle on
oman kansion `memory/data/` ja `eval/`.

**Agentti ei lue pelin dataa lainkaan.** Ei `points.json`, ei
`points.local.json`, ei pelaajan sijaintia, ei repon lähdekoodia. Tämä on
merkityksellistä, koska `AGENTS.md` sanoo että pelaajan sijainti ei poistu
laitteelta — agentti ei ole reitti jolla se voisi poistua, koska se ei koskaan
näe sitä.

---

## 2. Tarkistettu koodista: päätyykö pyynnön kenttä promptiin?

**Ei päädy.** `api/main.py`:

```python
async def puzzle(pair_id: str = "") -> Dict[str, Any]:
    return draw()
```

`pair_id` otetaan vastaan ja **jätetään käyttämättä**. `draw()` kutsutaan ilman
argumentteja, eikä sen allekirjoituksessa ole `pair_id`-parametria lainkaan —
se ottaa vain kirjoittajan, ratkaisijan, muistin ja yritysmäärän.

Rajapinnassa ei ole muita kenttiä. Ei runkoa, ei otsikkoa, ei tekstiä
pelaajalta. **Yksikään ulkopuolelta tuleva merkki ei päädy mallin promptiin.**

Tämä oli se kohta joka olisi tehnyt agentista kolmen kolmikon: pelaajan
kirjoittama teksti promptissa olisi ollut suoraan kohta 2. Sitä ei ole.

Rajapinta myös kuuntelee vain `127.0.0.1`, eli ei ole näkyvissä lähiverkkoon.

---

## 3. Tarkistettu koodista: päätyykö mallin oma tuotos toisen kutsun promptiin?

**Päätyy, kahta reittiä.**

**Reitti A — kirjoittaja ratkaisijalle.** `puzzle_solver.py:52`:

```python
contents=SOLVER_PROMPT + text
```

`text` on mallin itsensä kirjoittama pulma. Se liitetään sellaisenaan toisen
mallikutsun promptiin. Tämä on solve-backin koko idea: teksti lähetetään
yksin, ilman vastausta, ja jos toinen kutsu päätyy eri lukuun, teksti ei kanna
vastaustaan.

**Reitti B — muisti takaisin kirjoittajalle.** `puzzle_writer.py:85-86`:

```python
recent = "\n".join(f"- {text}" for text in avoid[-10:])
avoid_block = f"\n\nÄlä toista näitä äläkä kirjoita niiden kaltaisia:\n{recent}"
```

`avoid` tulee `memory.texts()`-kutsusta, eli aiemmin annetuista pulmista, jotka
malli on itse kirjoittanut ja jotka on tallennettu levylle. Mallin tuotos siis
kiertää tiedoston kautta takaisin seuraavan kutsun promptiin.

### Mitä se voi siellä tehdä

Tämä on se kysymys johon vastaus ratkaisee vakavuuden, ja vastaus on
rajattu — ei koska luotamme malliin, vaan koska **ulostulon reitti on kapea**:

- Ratkaisijan vastauksesta poimitaan **säännöllisellä lausekkeella ensimmäinen
  kokonaisluku**, ja se verrataan kirjoittajan ilmoittamaan lukuun. Mitään muuta
  ratkaisijan tuottamasta tekstistä ei käytetä mihinkään.
- Ratkaisijalla ei ole työkaluja, ei funktiokutsuja, ei tiedostopääsyä eikä
  hakua. `GenerateContentConfig` sisältää vain lämpötilan.
- Kirjoittajan tuotos kulkee `check_schema`n läpi ennen kuin se päätyy
  mihinkään: sen on oltava objekti, `text` merkkijono, `answer` kokonaisluku
  väliltä 0–999999.

**Pahin uskottava seuraus:** pulmatekstiin upotettu ohje saa ratkaisijan
tulostamaan halutun luvun, jolloin solve-back on samaa mieltä ja **kelvoton
pulma läpäisee tarkistuksen**. Se on oikeellisuushyökkäys, ei tietovuoto:
mitään yksityistä ei lähde ulos, koska mitään yksityistä ei ole promptissa.

Toinen, teoreettisempi: jos jokin muu prosessi pystyisi kirjoittamaan
`memory/data/issued_puzzles.json`-tiedostoon, sen sisältö päätyisi kirjoittajan
promptiin reittiä B. Tällä hetkellä siihen kirjoittaa vain agentti itse, mutta
**tiedosto on prompti-injektion pinta**, ja se on syytä tietää ennen kuin
muistia jaetaan minkään muun kanssa.

---

## 4. Täyttyykö kaksi vai kolme?

**Kaksi kolmesta.** Nyrkkisääntö pitää.

| | Täyttyykö | Millä perusteella |
|---|---|---|
| 1. Pääsy yksityiseen dataan | **kyllä, kapeasti** | `agent_env.py` lataa `.env` ja `.env.local` jokaisesta yläkansiosta juureen asti. Tällä koneella se on kaksi tiedostoa repon juuresta; toisella koneella se voi olla mitä tahansa mitä polulla sattuu olemaan. Agentti tarvitsee niistä yhden arvon. Pelin dataa se ei lue lainkaan |
| 2. Altistuminen epäluotetulle sisällölle | **ei ulkopuolelta** | Yksikään pyynnön kenttä ei päädy promptiin. Ei hakua, ei URL-noutoa, ei käyttäjän tekstiä. Mallin oma tuotos kiertää promptiin kahta reittiä (§3), mikä on kohdan heikko, itseensä viittaava muoto — ei hyökkääjän hallitsemaa sisältöä |
| 3. Kyky viestiä ulos | **kyllä** | HTTPS Googlen rajapintaan. Tiedostokirjoitukset vain omaan kansioon |

Yhdistelmä 1 + 3 on hallittavissa, koska niiden väliltä puuttuu se mikä tekisi
siitä vuotokanavan: **mikään ei syötä agentille ohjetta ulkopuolelta.** Avain
menee Googlelle koska se on avaimen tarkoitus; muuta yksityistä ei ole
promptissa, koska promptissa on vain kiinteä ohjeteksti ja mallin omat aiemmat
pulmat.

### Mikä kääntäisi tämän kolmeksi

Yksikin näistä riittäisi, ja kaksi ensimmäistä olisi helppo tehdä vahingossa:

- **`pair_id`:n tai minkä tahansa pyynnön kentän välittäminen promptiin.**
  Yhden rivin muutos, ja pelaajan hallitsema teksti olisi promptissa.
- **Telineen mainostamien Gemini-työkalujen käyttöönotto.**
  `agents/AGENTS.md` luettelee `google_search`, `url_context` ja
  `code_execution`. Ensimmäiset kaksi tuovat epäluotetun sisällön suoraan
  promptiin, kolmas tuo koodin suorituksen. Tämä agentti ei käytä yhtäkään.
- **Agentin päästäminen lukemaan pelin tiedostoja**, esimerkiksi pisteiden
  nimiä pulmien paikallistamiseksi. `points.local.json` on paikka jossa joku
  seisoo.
- **Rajapinnan avaaminen `0.0.0.0`:aan** laitetestausta varten. Silloin kuka
  tahansa lähiverkossa voi kutsua sitä.

---

## 5. Mitä kirjattiin, mitä ei muutettu

Koodiin ei koskettu. Kolme merkintää `INBOX.md`:ssä:

1. `agent_env.py` kävelee tiedostojärjestelmän juureen ja lataa jokaisen
   löytämänsä ympäristötiedoston, vaikka agentti tarvitsee yhden avaimen.
2. Mallin tuotos palaa promptiin kahta reittiä, ja muistitiedosto on
   prompti-injektion pinta jos jokin muu pääsee kirjoittamaan siihen.
3. Telineen omat esimerkit mainostavat hakua, URL-kontekstia ja koodin
   suoritusta; niiden käyttöönotto tässä agentissa kääntäisi arvion kolmeen
   kolmesta.

Mikään näistä ei ole tämänhetkinen haavoittuvuus. Ne ovat kohdat joissa
seuraava muutos voi tehdä siitä sellaisen.
