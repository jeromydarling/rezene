import type { Lesson, QuizQuestion } from "./types";

// Expansion lessons for F3 · Economics of Fashion — appended after the
// original four (progress is keyed by lesson index, so append-only).
export const F3_MORE_LESSONS: Lesson[] = [
  {
    title: "Why she buys: the hungers underneath fashion",
    minutes: 10,
    source: { label: "Nystrom, ch. 3 — The Psychology of Fashion", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `Fashion, Nystrom insists, is "a fact of numbers" — a phenomenon of social psychology, of like-mindedness and common imitation. So to explain why it moves, he goes looking not at hemlines but at what he carefully calls **hungers** (he avoids the fighting word "instinct"): the common tendencies in human nature that drive all buying. His catalog runs from the will to live through companionship, self-assertion, curiosity, ownership, construction, play, travel and the hunger for beauty. Out of that list he then selects the specific motives that actually cause fashion change — and this short list is one of the most useful pages in the book.

**Boredom.** The simplest cause: garments worn through a season "have tired the eye and the sense of touch." People whose lives are narrow, or who hold what Nystrom names the **philosophy of futility** — no strong purpose, so attention pools in surfaces — tire of their things fastest and greet new fashions most eagerly.

**The change-of-personality effect.** A change of dress gives the illusion of a change of self. His example is the housewife who, work done, trades the apron for an afternoon dress: "the change makes a lady out of her." People buy new clothes after defeats for exactly this reason. It is one of the kindest insights in the book, and it is why good product copy sells a *feeling of becoming*, not a seam allowance.

**Curiosity and adventure.** The first woman in town to try a new garment gets a small thrill — part fear of disapproval, part hope of it. Early adopters are paid in sensation.

**Rebellion of youth.** New styles are "offered with all the ardor of revolution." Youth (roughly 15 to 25, by his reckoning) struggles against custom, wins some reforms, then settles down at 25 and defends the new custom against the next wave — which is why he thinks youth movements and their fashions run in long cycles.

**Self-assertion and the inferiority feeling.** Borrowing from Alfred Adler, Nystrom argues the strongest engine is the desire to be different, to be recognized — which grows out of feeling *less than*. Loud apparel, social climbing, "keeping up with Lizzie": symptoms, all. Dress is the cheapest available proof of standing.

**Companionship and imitation.** The counterweight. Groups are "tyrannical"; to dress differently is to be thought queer, so most people imitate. "Imitation is of course second-rate origination" — origination takes time, art, money and courage, so it is left to the few, and inside every group early imitation is itself a little competition.

> **Term note:** Nystrom's *philosophy of futility* — consumption as restless signaling by people without deeper purpose — is the phrase this course already met in lesson one. Here you see where it lives in his argument: it is a boredom-accelerant, not a moral judgment.

He then spends several pages on the era's favorite debate — **do women dress to please men?** — and dismantles it: if men had been consulted, bobbed hair, skull-cap millinery, heavy rouge and slave bracelets would never have swept the country. Sex appeal explains the desire to be attractive; it cannot explain *change*, because a decoration that works would never be discarded. Fashion moves for the reasons above, not for the audience men imagine themselves to be.

The chapter closes with a rule your marketing should be tattooed with. Advertising, he shows with the Gillette safety razor, does not start fashions — Gillette succeeded because smooth shaving was *already* rising; launched twenty-five years earlier, into the era of full beards, it would likely have failed. Commercial promotion works when it goes with a trend and fails against one. His order of operations: **first find the trend, second push the goods that go with it, third tell the truth about style and fashion** — claiming something is in fashion when it is not injures you exactly like lying about construction.

In your studio today: this is why your R&D flow runs research-then-product and not the reverse. A trend board with sources is "find the trend"; the line plan that follows it is "push the goods that go with it." And when you write a product page, write to a hunger from this list — becoming, belonging, small adventure — because that, per Nystrom, is what is actually being purchased.`,
    checkpoints: [
      {
        q: "Nystrom's explanation for why a change of clothes lifts a person after a bad day:",
        options: [
          "new fabric is physically comfortable",
          "a change of dress gives the illusion of a change of personality",
          "shopping releases suppressed anger",
        ],
        answer: 1,
      },
      {
        q: "The Gillette safety razor succeeded, in Nystrom's telling, because…",
        options: [
          "advertising created the smooth-shaving fashion from nothing",
          "smooth shaving was already a rising trend it could ride",
          "beards were banned after the war",
        ],
        answer: 1,
      },
      {
        q: "\"Imitation is second-rate origination\" implies that most people imitate because…",
        options: [
          "origination takes time, money, art and courage most people lack",
          "imitation is legally safer",
          "originality is a modern invention",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Events, ideals, and the people everyone watches",
    minutes: 10,
    source: { label: "Nystrom, ch. 4 — Factors That Influence the Character and Direction of Fashion Movements", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `If the last lesson explained why fashion *moves*, this chapter asks what steers it — why the river takes this valley and not that one. Nystrom's answer is a three-part frame you can still run a trend meeting on: **dominating events, dominating ideals, and dominating groups.**

**Dominating events.** The World War put millions into khaki, slowed all fashion movement, and left women's dress in mourning black through 1919 and 1920 — an entire palette set by grief. Smaller events steer too, and his examples are wonderful. Louis Kossuth arrived from Hungary in 1851 wearing a soft felt hat into a nation of stiff "chimney pot" hats; by 1860 perhaps half of American men wore soft hats. The Prince of Wales's double-breasted frock coat of 1860 became *the* formal coat — the Prince Albert — for thirty years. But Nystrom is just as interested in the fade: the 1924 Prince of Wales visit, heavily pre-promoted by the trade, moved only items that were already moving, and Queen Marie of Roumania's 1927 tour sold little beyond some long pearl necklaces. Celebrity moves fashion when it *lands on a readiness*, not by royal decree. Art events steer harder: the Russian ballet's arrival in Paris in 1909 seeded the whole modern-art movement in decoration; the Tut-Ankh-Amen tomb discovery of 1923 put ancient Egypt into fabrics, millinery and jewelry within a year; and the great expositions — Philadelphia 1876, Chicago 1893, Paris 1925 — each reset public taste for a decade.

![Line chart of four neckline styles' popularity, 1920-1926](/school/economics-of-fashion/lesson0-neckline-trends.jpg)
*Nystrom, plate 2 — necklines displacing one another season by season, 1920–1926: direction is visible only when you track it continuously.*

**Dominating ideals.** Eras have moods. A period of **youth movement** — his own 1920s — dresses everyone young, shaves the beards, worships sport; a period of maturity-worship (he points to 1860–1900) does the opposite, with boys lying upward about their age and students growing beards to look senior. Religious and national ideals matter too, mostly as brakes; he notes drily that Mussolini's 1924 demand that Italian women wear Italian fashion accomplished nothing, because fashion is stubbornly international.

**Dominating groups.** Royalty once set fashion; by 1928 that power had passed to *wealth*. Here Nystrom leans openly on Veblen's Theory of the Leisure Class: wealth must be demonstrated, and the two demonstrations are **conspicuous leisure** (habits and garments proving you need not work — the spotless collar, the frail pince-nez, the high heel) and **conspicuous consumption** (visible expense). From this he mints a blunt business rule: *a style, to succeed as a fashion, must suggest either conspicuous leisure or conspicuous expensiveness* — it must look as if its wearer does no rough work, and it must "look like a million dollars." One refinement: as customers grow sophisticated, the display of expense turns subtle. Gilt gives way to cut and cloth that only those who know, know.

> **Term note:** *conspicuous consumption* — Veblen's 1899 coinage for spending whose real product is social proof. Nystrom's contribution is turning it into a merchandising test you can apply to a sample on the table.

In your studio today: the frame is directly usable. Your watched-brand dossiers with their "what changed" notes are a dominating-events log; the ideals column is whatever your decade worships (wellness, craft, quiet money); and the Veblen test still decides price positioning — the modern luxury signal is precisely the subtle-expense endgame he predicted, expense legible only to insiders. When a real event lands in your category — an exhibition, a film, a royal wedding — ask Nystrom's question first: is there a readiness here for it to land on?`,
    checkpoints: [
      {
        q: "Nystrom's three steering factors for fashion direction are…",
        options: [
          "price, quality, and advertising",
          "dominating events, dominating ideals, and dominating groups",
          "Paris, London, and New York",
        ],
        answer: 1,
      },
      {
        q: "The 1924 Prince of Wales visit and Queen Marie's 1927 tour showed that celebrity…",
        options: [
          "had become the strongest force in fashion",
          "moves fashion only when it lands on an existing readiness",
          "works only for menswear",
        ],
        answer: 1,
      },
      {
        q: "Nystrom's Veblen-derived rule: to succeed as a fashion, a style must…",
        options: [
          "suggest conspicuous leisure or look convincingly expensive",
          "be cheaper than last season",
          "be approved by a fashion council",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Custom: the slow twin that pays the rent",
    minutes: 9,
    source: { label: "Nystrom, ch. 6 — The Influence of Custom on Consumption", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `Nystrom's cleanest definition in the whole book: in fashion, people imitate their contemporaries; in **custom**, they imitate their elders and past generations. "Fashion represents the ascendency of the present over the past; custom represents the ascendency of the past over the present." Custom is social habit — and like any habit it resists change and collects veneration as it ages.

He sorts all human activity into three bins: custom, fashion, and **individual initiative** — and observes that the third bin is nearly empty. Even our "original" variations barely stray from inherited or contemporary models. What remains is a permanent border war between the first two: custom holds some territories almost completely (language, religion, law, ceremony, government), fashion holds others, and between them lies contested ground that swings back and forth by era.

The chapter's pleasure is his tour of custom's strongholds, because so many are commercial territories a designer sells into. Weddings are wall-to-wall custom: the ring on the fourth finger of the left hand, the veil, the white dress, bridesmaids, rice, cake. Funerals and **mourning** dress, graduation robes, judges' and clergy's vestments, servants' and nurses' uniforms, holiday rituals — all governed by the past, and customers *resent* innovation in them. Even the most fashion-ruled garment carries fossils of custom. His famous examples: buttons close right-over-left for men (a man's right hand held tool or weapon; the left buttoned) and left-over-right for women (the baby rode on the left arm, leaving the right hand to button); the buttons at the back of a frock coat once let the skirts open for horseback riding. The garment remembers what the wearer has forgotten.

Two working consequences follow.

**First: custom-ruled categories behave differently as businesses.** Where custom rules, demand is stable, styling changes slowly, and value comes from correctness and quality rather than novelty. Bridalwear, ceremonial and occasion dress, liturgical work, uniforms, mourning-adjacent formalwear: these reward the maker who studies the tradition and executes it beautifully, and they punish gratuitous innovation. They are also markdown-resistant, because their value does not decay on fashion's schedule. A small label with one custom-anchored category alongside its fashion line has, in Nystrom's terms, annexed a province where the cycle barely blows.

**Second: fashion succeeds only by managing its break with custom.** The adoption of a fashion is, in his phrase, "the breakup of custom" — but a new fashion that breaks *too* abruptly is rejected as queer. The winning innovation keeps enough of the customary form to be legible while changing enough to feel new. Even the table fork, he notes, took over a hundred years to be generally accepted. When your most experimental piece dies in the shop while a gently updated classic sells out, this chapter is the autopsy.

> **Term note:** *mourning* was a codified consumer category in this era — special blacks, crepes, and stationery, worn on a prescribed schedule after a death. Entire departments served it. It is the strongest historical proof that custom, not fashion, can be the backbone of a garment trade.

In your studio today: audit your line against the three bins. Your signature blocks — the pieces you improve yearly — live closer to custom than to fashion, which is exactly why the earlier lessons told you to treat them as keepers. If you take commissions, notice how much of the brief is custom ("it must read as a wedding dress") and how little is fashion; price the correctness and the cloth, not the novelty. And before you "disrupt" a ceremonial category, reread the table fork.`,
    checkpoints: [
      {
        q: "Custom differs from fashion in that custom imitates…",
        options: [
          "contemporaries",
          "past generations and elders",
          "foreign countries",
        ],
        answer: 1,
      },
      {
        q: "Why do men's and women's garments button on opposite sides, per Nystrom?",
        options: [
          "a vestige of old use — weapon hand for men, baby on the left arm for women",
          "an 1890s law standardized it",
          "it strengthens the placket",
        ],
        answer: 0,
      },
      {
        q: "Commercially, custom-ruled categories such as bridalwear tend to…",
        options: [
          "reward correctness and quality, and resist markdowns",
          "demand constant novelty",
          "follow the normal fashion cycle exactly",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Modesty, utility, and the rules fashion may bend but not break",
    minutes: 10,
    source: { label: "Nystrom, ch. 7–8 — Modesty and Utility in Relation to Fashion", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `A new fashion, Nystrom writes, always breaks with custom somewhat and always transgresses modesty somewhat — that is what makes it new — but it may not go *too far* in either direction. These two chapters map the fence lines.

**Modesty is custom wearing a blush.** His argument is bracingly unsentimental: modesty is "a careful observance of custom," and the feeling of shame arises when custom is broken — nothing more mystical than that. The proofs are comparative: cultures cover different things and blush at different exposures; a bathing costume entirely modest on the beach is immodest on the street two blocks away; the first bobbed heads felt "queer akin to immodesty" until the practice spread, whereupon the feeling simply evaporated. Modesty has no fixed content — it tracks whatever is customary. Crucially for a merchant: the modesty objection only has teeth in a fashion's *early* stage. Once group acceptance grows, "the feeling of solidarity in the growing group overcomes the feeling of immodesty" and the criticism loses all force.

He then catalogs fashion's professional opponents — and their unbroken record of defeat. The church has condemned new fashions in every age; fashion won every round. Governments tried **sumptuary laws** — medieval statutes restricting luxury dress by social class — with vestiges surviving in bathing-costume ordinances; fashion shrugged. Doctors preached against tight lacing for four hundred years (one eighteenth-century physician blamed it for ninety-two named diseases); tight lacing died when fashion changed, not when medicine spoke, and the doctors moved on to high heels — while heels went higher. Editors condemn in the editorial pages what their fashion pages extol. The lesson is not that critics are wrong; it is that fashion answers only to mass acceptance.

**Utility is the modern entry ticket.** By 1928, Nystrom judges, a fashion had little chance of wide adoption "unless one of its principal arguments was utility" — a genuinely new condition, not true of the leg-o'-mutton sleeve or the bustle. But here is the twist he documents with relish: the utility may be **simulated**. Buttons that button nothing; pockets too shallow to hold anything; and above all "sports clothing" — dresses faintly symbolic of tennis whose wearers never play, until the trade coined the honest term **spectator sports** wear in the spring of 1928. The simulation of practicality supplies the *note* of utility a modern fashion needs, whether or not the utility is real.

Men's dress gets the sharper knife: the suit too heavy, the collar half-strangling, pockets that would spoil the line if used, creased trousers proving only that the knees never bend. And a cost problem: a man who pays $35 to $50 for a suit — think roughly $630 to $900 in today's money — cannot justify an equal sum for a hot-weather suit worn ten weeks a year. Cheap, cool, shape-holding summer clothing "still remains to be provided," he writes; several decades of textile engineering eventually answered him.

> **Term note:** *spectator sports wear* — the 1928 trade coinage for garments styled for sport but worn to watch it. It survives today, mostly stripped of the confession embedded in it. Athleisure is its direct descendant.

In your studio today, two fence-tests before a risky piece goes into the line. First, the modesty test: is this transgression within reach of my customers' current custom, or a full stage beyond it? You can lead by half a step; a full step gets refused, then adopted three seasons later from someone else. Second, the utility test: does this piece carry a plausible practical argument — and if the utility is partly symbolic, is any *stated* claim real? Nystrom's era could sell fake pockets in silence; your era's customer reviews will test every claim in public. Simulate mood freely; never simulate a specification.`,
    checkpoints: [
      {
        q: "Nystrom's account of modesty: the feeling of shame arises when…",
        options: [
          "skin is exposed, universally",
          "custom is broken — modesty simply tracks the customary",
          "clothing is inexpensive",
        ],
        answer: 1,
      },
      {
        q: "Four hundred years of medical campaigning against tight lacing ended when…",
        options: [
          "fashion changed on its own schedule",
          "a law banned corsets",
          "doctors won public opinion",
        ],
        answer: 0,
      },
      {
        q: "\"Spectator sports\" clothing exemplifies Nystrom's point that a modern fashion needs…",
        options: [
          "real athletic function",
          "at least the appearance of utility, even simulated",
          "a celebrity endorsement",
        ],
        answer: 1,
      },
    ],
  },
  {
    title: "Anatomy of a fashion capital",
    minutes: 10,
    source: { label: "Nystrom, ch. 9 — The Fashion World", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `Why Paris? Nystrom refuses to accept "taste" as an answer and instead performs an autopsy on a fashion capital — and the organs he finds are ones any modern scene-watcher will recognize.

**Scale of making.** Paris in the 1920s held nearly 300,000 people producing women's apparel and accessories — a quarter of the city's population worked directly or indirectly on dress. There were more than **80,000 dressmaking shops** in Paris alone (more, he notes, than in the entire United States), of which over 200 employed 500 or more people and at least 25 employed over a thousand. The **couture** poured out designs at a rate that still astonishes: the great houses produced 500 to 1,000 models a year each, the industry perhaps 10,000 designs per season and not less than **25,000 per year**. And then the honest whisper: insiders reckoned barely *a score* of houses were true originators; the rest varied and copied. A fashion capital is a pyramid — a tiny creative point on an enormous industrial base.

**A circuit, not a city.** The fashionable world moved on a seasonal loop — Riviera and Egypt in winter, Paris in spring, the Channel watering places in summer, Biarritz in autumn — and Paris sat athwart the whole route. The customers, in other words, kept arriving on schedule, twice a year, with money and occasions.

**Deep craft supply.** Girls trained from childhood at needle and scissors, an apprenticeship system, trade schools, art museums, libraries and a permanent population of textile and costume artists. Every material and trimming — lace, braid, beads, feathers — made or marketed within the city.

**A class of women who dared.** Here is his most striking structural point: new styles need somewhere to be *tried*, and trying is socially expensive. "For a woman to wear a distinctly new style in a typical middle western American town would be to stamp herself as queer." Paris concentrated the exceptions — actresses (who launched styles from the stage), wealthy newcomers with little to lose and prestige to win, women who made smart dressing their profession, and the demi-mondaines. Without this experimental class, he says flatly, new styles could not get their tryout. Every fashion capital since has run on the same fuel: a district where audacity is cheap.

**Prestige — and its arithmetic.** By long habit, the world's buyers, editors and designers had *invested* in Paris; their taste leaned toward their investments. The numbers behind the mystique are the chapter's best surprise: total imports of Paris garments were perhaps **half of one per cent** of American retail garment sales, and stores often sold true French models at or below landed cost — the real product was the word "Paris" in the advertising, with the profit made on reproductions. Better still, ideas created elsewhere were routinely shipped to Paris to be *launched* there, because a Paris debut was worth more than an honest byline. Paris was, among other things, a credibility machine that outsiders paid to run their work through.

> **Term note:** the *couture* is simply the French dressmaking trade — from making one-off garments to, after 1921, increasingly organized quantity production. The famous handful of artistic houses sat atop tens of thousands of ordinary workrooms.

In your studio today: substitute your own capital — a fair, a district, a platform feed — and the anatomy still holds. Ask of any scene you consider entering: where is the industrial base, where is the circuit of arriving customers, where is the experimental class, and who is charging rent on prestige? And note the razor in the numbers: half a percent of sales carried nearly all the mystique. When you stock one prestige piece to sell twenty accessible ones, you are running the 1928 department-store play, knowingly — which is the only good way to run it.`,
    checkpoints: [
      {
        q: "Of Paris's thousands of dressmaking houses, insiders counted the true originators at…",
        options: ["barely a score", "several hundred", "all 80,000"],
        answer: 0,
      },
      {
        q: "Nystrom says new styles could get their tryout in Paris because the city concentrated…",
        options: [
          "women who could afford to dare — actresses, new-rich, professional dressers",
          "the strictest dress codes",
          "government subsidies for novelty",
        ],
        answer: 0,
      },
      {
        q: "Paris garment imports were about half of one per cent of US retail garment sales, yet dominated advertising, because…",
        options: [
          "stores profited on the prestige and sold reproductions, not the models",
          "tariffs made imports profitable",
          "French garments never sold at all",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "The couture's ledger: openings, models, and the copyists at the door",
    minutes: 10,
    source: { label: "Nystrom, ch. 10 — The Haut Couture of Paris", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `Having mapped the fashion world, Nystrom walks inside a great dressmaking house — and the business model he documents is a masterclass in selling design when design cannot be protected.

**The structure.** Of Paris's dressmakers, perhaps 200 merited the title **haut couture**, about twenty-five mattered at any moment, and members themselves said there were "not over fifteen actual style creators." The leaders organized as the **Chambre Syndicale de la Couture** — a trade association that exchanged style information, coordinated the calendar so only two or three houses opened per day (so traveling buyers could see them all), set labor standards and apprenticeships, and fought copying. Inside a house: the **vendeuse** (head saleswoman, with her own following of clients), her seconde, the **premières** heading the workrooms, the **midinettes** — the young workers, apprenticed at thirteen or fourteen, attending five hours of classes a week in textiles, art history and cutting — and the manikins, the live models whose selling power houses had lately learned to pay commissions on.

**The cash mechanics.** Two clever asymmetries kept a house liquid. Fabrics and trimmings arrived from mills **on consignment** — a stockroom holding thousands of dollars of goods with almost no investment, settled seasonally. And after the war the houses diversified into perfume, millinery, lingerie and handbags: repeatable, marginful side lines under a name made famous by dresses. (Every modern designer-fragrance empire is this paragraph, compounded for a century.)

**The openings.** The seasonal showings — February and August, plus growing mid-season showings — ran in a fixed order that is really a pricing strategy: first the **press** (publicity), then **social notables** (prestige and early orders), then the **professional buyers** from abroad, who came either to buy models to resell as originals or — openly — to buy models *in order to copy them*.

**And the copying.** Style piracy was "the most difficult and at the same time the most engrossing problem" of the trade. Copies appeared at the same time as originals, at half the price or less. Houses locked new designs in safes before openings, vetted visitors, sometimes required purchase commitments just to attend, and sued relentlessly under the French design-registration law — which, Nystrom drily notes, "does not stop the clever imitator." The United States offered **no design protection at all** (it still barely does for garments). The gray market was baroque: importers rented one model to several manufacturers in succession; retail buyers rented their Paris purchases to Seventh Avenue before displaying them; and importers re-exported models after copying to reclaim the American tariff — which on lace-trimmed or embroidered goods ran a staggering **90% of the merchandise value**. A $200 embroidered model — call it $3,600 in today's money — carried nearly that much again in duty, which is precisely why renting and re-exporting paid.

> **Term note:** a *model* in this trade is not a person but a garment — the original design specimen, sold, rented, copied and re-exported like the intellectual property it legally wasn't.

In your studio today: you inherit both seats. As the copied: assume anything that works will be knocked off within a season, and note what actually defended the couture — speed to the next idea, a name worth more than the garment, direct relationships (the vendeuse's personal book), and side lines that monetize the name. Your version: release cadence, brand, your client list, and the accessories or small-leather line. As the inspired: buying a garment to study construction is the industry's oldest tuition, but reproducing another designer's distinctive work line-for-line is the thing this chapter's victims spent fortunes fighting — adapt at the level of silhouette and idea, as the honest end of the trade always has.`,
    checkpoints: [
      {
        q: "At a grand opening, the first showing of a new line usually went to…",
        options: ["professional buyers", "representatives of the press", "the midinettes"],
        answer: 1,
      },
      {
        q: "Couture stockrooms could hold thousands of dollars of fabric with almost no investment because…",
        options: [
          "mills supplied goods on consignment, settled seasonally",
          "the government paid for materials",
          "clients supplied their own cloth",
        ],
        answer: 0,
      },
      {
        q: "Copyists could rent a Paris model, reproduce it, and then…",
        options: [
          "re-export it to reclaim a tariff running up to 90% of its value",
          "sell it back to the couturier",
          "register it as their own French design",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "Overcapacity, hand-to-mouth, and the shrinking dress",
    minutes: 11,
    source: { label: "Nystrom, ch. 17 — Trends in Apparel Production Since 1918", url: "https://archive.org/details/economics-of-fashion-1928-paul-nystrom" },
    bodyMd: `This chapter is Nystrom reporting live from the birth of the market you sell into. Between 1919 and 1927 the American garment trade acquired, in a decade, nearly every structural feature a modern independent brand still wrestles with.

**Boom, revolt, bust.** After the armistice came a spending wave — silk shirts on laboring men, silk everything for women who had thought it a luxury. Prices spiraled until, by mid-1920, the public *rebelled*: consumer strikes and "overall parades," demand collapsing into the depression of 1921. What emerged afterward was a changed industry.

**Chronic overcapacity.** Entry was absurdly easy — the main equipment was sewing machines, cheap and second-hand — so capacity ran an estimated **50% beyond demand**. A 1924 New York survey found 15,896 machines in the industry with only 11,433 running at the height of the season. The average plant had about twenty workers; 45% of concerns had fewer than fourteen machines. Too many small firms chasing too little business, owned by people "willing to take any chance and make any concession": the buyer's market was structural, and it never really ended.

**Hand-to-mouth buying.** Retailers stopped ordering three to six months ahead and began buying only what they could sell immediately — six weeks to two months out, with frequent small trips to market replacing the great semiannual buying visits. Manufacturers had to produce ahead of orders or sit idle: perhaps six weeks of active production, ten slack, ten dead. Seasons multiplied — many retailers wanted **five openings a year** (spring, summer, fall, winter, and a December resort season). Cancellations and returns ran **5% to 15% of gross sales**. If this sounds like your wholesale accounts, it should; the terms were set a century ago.

![Curve of consumer buying cycle peaking before the consumer use cycle](/school/economics-of-fashion/lesson1-consumer-buying-cycle.jpg)
*Nystrom, plate 3 — buying peaks before use does. Hand-to-mouth retailing was the trade reorganizing itself around this curve, pushing timing risk back onto makers.*

**The jobber flips the industry.** In 1910, about 90% of women's wear was made by manufacturers under their own roofs. By 1924 the situation had reversed: **less than 20%** was made in-house, and fully 80% by sub-manufacturers working for **jobbers** — stock houses that bought fabric, contracted out all making, and specialized purely in buying and selling. Jobbers carried 10,000 to 50,000 garments ready for immediate delivery, changed styles weekly, turned stock as often as ten times a year, and ran on net profits of **2% to 5% of sales**. Speed and thinness of margin as a business model: fast fashion's grandfather, fully formed in 1924.

**The concentration rule.** Amid the noise, one merchandising fact Nystrom flags deserves a frame on your wall: a line might contain 200 to 300 models, yet **three-quarters or more of the volume came from 5% to 10% of the models**. The whole modern discipline of line simplification is in that sentence.

**And the dress itself shrank.** His Plate 145 compares outfits: the 1913 woman's ensemble took some 19¾ yards of fabric across nine garments (with the full wardrobe reckoning running to 30 yards); the 1928 outfit took about **9 or 10 yards** across five, and had switched from cotton and wool to silk and rayon. Half the cloth, twice the fashion content — the textile mills' crisis and the designers' opportunity, in one table.

> **Term note:** a *jobber* here is not a middleman reselling surplus but the organizing capitalist of the trade — fabric buyer, style curator and sales house, with production entirely contracted out. Today you would call it a brand.

In your studio today: run the concentration rule against your own sell-through — name the 10% of styles carrying the volume, and ask honestly what the other 90% are for (some are legitimate scaffolding: range, press, testing; most are cost). Respect the overcapacity lesson when quoting against bigger players — you cannot win a thin-margin speed game against a jobber, so sell what the jobber structurally cannot: depth, make, and a name. And read every wholesale term sheet knowing returns and cancellations were invented to move risk onto you; cap them in writing.`,
    checkpoints: [
      {
        q: "Between 1910 and 1924, women's wear made by manufacturers under their own roofs went from…",
        options: [
          "about 90% down to under 20% — the jobber system took over",
          "20% up to 90%",
          "50% to 50%",
        ],
        answer: 0,
      },
      {
        q: "Nystrom's concentration rule: three-quarters or more of a line's volume typically came from…",
        options: ["every model equally", "5% to 10% of the models", "the cheapest third"],
        answer: 1,
      },
      {
        q: "Hand-to-mouth buying meant retailers…",
        options: [
          "ordered only what they could sell immediately, pushing timing risk onto makers",
          "paid in advance for full seasons",
          "bought only domestic goods",
        ],
        answer: 0,
      },
    ],
  },
  {
    title: "The dull season: the people who sew, and buying production responsibly",
    minutes: 11,
    source: { label: "Pope, Part II — wages, the task system, and regulation", url: "https://archive.org/details/clothingindustry00poperich" },
    bodyMd: `Pope's study gave this course its map of the contracting system; his later chapters give it a conscience — and a set of negotiating facts about seasonality that still price your production runs.

**The trade breathes in seasons.** Even after manufacturers learned to stretch the year — making goods for different regions at different times, throwing cheap staple work into slack months — the **dull season** still ran *two to five months*: shortest for cutters, longest for workers on cloaks and women's suits. Wages in the dull season ran **15% to 20% lower** than in the busy season, when higher piece rates and overtime swelled the pay envelope. A workroom's year was feast and famine on a schedule set by fashion's calendar.

**The task system.** Pope's most careful analysis concerns the era's notorious wage scheme, introduced by contractors just before 1880 and covering most New York coat-making until about 1895. Under the **task system**, a team was paid a fixed daily wage — say **$3 a day** (roughly $105 in today's money) — for completing a set "task," say ten coats in ten hours. Come the dull season, keeping that $3 required accepting a bigger task: twelve coats, twelve hours. And the ratchet, critics charged, never released — the dull-season task became the next busy season's baseline. Unions fought it for decades ("weekly work at a standard rate of wages"), and by 1905 under a quarter of coat workers remained on it. Pope, characteristically, complicates the villainy: under straight piece or time wages the dull season cut the *pay* instead; under the task it cut the *conditions* — "in the one, greater intensity or longer hours, in the other less to eat and wear." The choice the season forced was between two ways of being poorer. The real culprit was the seasonality itself.

**What the work paid.** By 1902 cutters — the trade's aristocrats — averaged **$938 a year** (think mid-$30,000s today), coat operators about **$576**, women vestmakers **$389**. Pope's wage tables show real earnings *rising* from the 1880s — organization, machinery and union pressure were working — but from a very low floor, with the dull season carving a hole in every yearly total.

**How it was reformed.** Not, Pope argues, by any single stroke. New York's 1892 Board of Health Act restricted tenement homework to immediate family, required permits after inspection, and ordered goods so made to be **tagged**; laws of 1897, 1899 and 1904 tightened licensing, made whole buildings the unit of inspection, and published lists of contractors so manufacturers could see where their work actually went. Labor added the **union label**; the public added the **Consumers' League label**, granted after investigation to a "fair house" — "Made under clean and healthful conditions. Use of label authorized after investigation." Pope is skeptical of labels' commercial power — consumers, he observes, buy where it serves them best, and a label "cannot make its way by depending on the consumer as such" — and credits instead "the gradual evolution of social forces": law, inspection, unions, publicity, and an industry growing rich enough to afford decency.

> **Term note:** the *sweating system* — production pushed down through contractors into tenement homes at starvation piece rates — is the disease all this machinery treated. The 1892 tag law is a direct ancestor of every "made in / certified by" label in your closet.

In your studio today, this chapter converts into three practices. First, *use the season*: your maker has a dull season too, and work placed in it is cheaper, faster and more welcome — ask when it is, and book sampling and staple runs there; you will get their best people at their least frantic. Second, *audit like the League*: published contractor lists and inspected premises are now called supply-chain transparency and social audits — when a certification shows you a workroom, you are reading a fair-house label; and Pope's skepticism still applies, so verify rather than assume the label sells itself or polices itself. Third, *be the steady customer*: the cruelest thing in this trade was never the piece rate, it was the famine between seasons — and a small brand that feeds a workroom evenly through the year is doing more for the people at the machines than any label on the hangtag.`,
    checkpoints: [
      {
        q: "Pope's dull season lasted…",
        options: [
          "two to five months, with wages 15–20% lower",
          "one week a year",
          "half the year, with double wages",
        ],
        answer: 0,
      },
      {
        q: "Under the task system, the dull season showed up as…",
        options: [
          "a bigger task for the same daily wage — more coats, longer hours",
          "a shorter working day",
          "automatic layoffs with severance",
        ],
        answer: 0,
      },
      {
        q: "Pope credits the reform of sweatshop conditions chiefly to…",
        options: [
          "the gradual evolution of social forces — law, inspection, unions, publicity",
          "consumer labels alone",
          "a single federal statute",
        ],
        answer: 0,
      },
    ],
  },
];

export const F3_MORE_QUIZ: QuizQuestion[] = [
  { id: "f3q15", q: "Nystrom's order of operations for commercial promotion:", options: ["create the trend, then advertise it", "find the trend, push the goods that go with it, tell the truth", "undercut competitors, then advertise"], answer: 1 },
  { id: "f3q16", q: "To succeed as a fashion, per Nystrom's Veblen-derived rule, a style must…", options: ["suggest conspicuous leisure or look expensive", "be the cheapest in its category", "be certified by the Chambre Syndicale"], answer: 0 },
  { id: "f3q17", q: "Custom, as against fashion, is imitation of…", options: ["contemporaries", "past generations", "foreign capitals"], answer: 1 },
  { id: "f3q18", q: "At a Paris couture opening, the first showing of a new line usually went to…", options: ["the press", "professional buyers", "the mills"], answer: 0 },
  { id: "f3q19", q: "By 1924, the share of women's ready-to-wear made by manufacturers under their own roofs was…", options: ["under 20% — jobbers and sub-manufacturers made the rest", "about 90%", "exactly half"], answer: 0 },
  { id: "f3q20", q: "Pope's dull season in the New York garment trade ran…", options: ["two to five months, wages 15–20% lower", "a fixed six weeks", "only in wartime"], answer: 0 },
];
