# Prompt style — profil de style d'Adrien

Statut : **en attente qu'Adrien le fasse**. Ce fichier existe pour qu'on ne perde
pas le contexte entre deux sessions — voir [[mage-stylist-direction]] (mémoire) :
phase 3 de la roadmap Mage Stylist, "système d'identité de style", le chantier
qu'Adrien a demandé en premier lors de sa revue du 22/07/2026.

## À quoi ça sert

Deux choses consomment ce profil dès qu'il existe :

1. **Le moteur de tenues** (phase 3, pas encore câblé) — scorer/validator/advisor
   liront ce texte pour biaiser les choix vers le style d'Adrien.
2. **L'analyse de photo en voyage** (câblé maintenant — `services/parser.ts` +
   `services/styleProfile.ts`) — quand Adrien envoie une photo d'une pièce achetée
   hors de Paris, le bot lit ce même document pour juger si la pièce colle à son
   style, en plus du climat parisien.

Tant que le document est vide, les deux se rabattent sur un jugement générique
(climat + polyvalence) — ça marche, mais en moins précis pour Adrien.

## Où coller le résultat

Google Doc **"Mage Stylist — Mon profil de style"**
ID `1wjnmI5yrC7VsKZazeCQkMs3SA5Uc0gF-17lEGgBZXh0`
(partagé avec `adrien@butterflyagency.io`, propriétaire `cristian@butterflyagency.io`)

Le doc a 3 sections : **Profil de style / Direction de style / Charte
vestimentaire** — le prompt ci-dessous est structuré pour remplir exactement ces
3 sections, dans l'ordre, prêtes à copier-coller.

## Le prompt à donner à Adrien (pour ChatGPT, Claude, etc.)

Adrien colle ce bloc tel quel dans son assistant IA préféré, répond aux
questions qu'il pose, puis colle la réponse finale dans le Google Doc ci-dessus.

````
Tu es un consultant en style vestimentaire. Je vais répondre à tes questions
sur ma façon de m'habiller, et je veux que tu en tires un document structuré
en 3 sections que je réutiliserai pour un assistant qui me recommande une
tenue chaque matin. Pose-moi tes questions une par une ou par petits groupes
(pas toutes d'un coup), puis à la fin, écris le document complet.

Pose-moi des questions pour couvrir, au minimum :

- Ce que je porte déjà le plus / ce que je ne mets jamais malgré qu'il soit
  dans mon armoire, et pourquoi
- Les couleurs que j'aime porter, celles que j'évite, et si j'ai une base
  neutre (noir, bleu marine, gris, beige…) ou si j'aime les couleurs franches
- Les matières que je préfère (coton, laine, denim, cuir…) et celles que je
  n'aime pas porter (irritation, entretien, allure)
- Les coupes que je préfère (slim, regular, oversize, structuré) pour le haut,
  le bas, les vestes
- Mon rapport à la formalité : est-ce que je m'habille différemment au bureau,
  en réunion, le week-end, à la maison ? Y a-t-il des pièces que je refuse de
  porter dans certains contextes (ex : jamais de chemise à la maison) ?
- Des marques ou des références de style que j'aime ou que je veux éviter
- Mon rapport au risque vestimentaire : est-ce que je préfère rester safe et
  cohérent, ou j'aime tester des pièces qui sortent de l'ordinaire ?
- Des pièces ou styles que je ne veux JAMAIS qu'on me recommande, même si la
  météo ou l'occasion s'y prêteraient

Une fois que tu as assez d'informations, écris le document final avec
exactement ces 3 sections :

1. **Profil de style** — qui je suis vestimentairement aujourd'hui : mes
   habitudes réelles, mes couleurs et matières préférées, ce que j'évite.
   Factuel, pas aspirationnel.

2. **Direction de style** — où je veux aller : ce que je veux porter plus
   souvent, les pièces que je veux intégrer, l'évolution que je vise.

3. **Charte vestimentaire** — des règles concrètes et actionnables qu'un
   assistant pourrait appliquer automatiquement, par exemple :
   - "Jamais de [pièce] en contexte [travail/maison/soirée]"
   - "Toujours privilégier [couleur/matière] pour [type de vêtement]"
   - "En formel, jamais [élément], toujours [élément]"
   - "Une pièce achetée hors de Paris ne me va que si [critère] — sinon je ne
     la porte pas au retour"

Écris en français, de façon concise et concrète — chaque règle de la charte
doit pouvoir être appliquée sans interprétation.
````

## Note pour Cristian

- `GOOGLE_STYLE_DOC_ID` (env var, wardrobe-knight) doit pointer vers l'ID
  ci-dessus pour que `services/styleProfile.ts` puisse le lire — le service
  account (`GOOGLE_SERVICE_ACCOUNT_JSON`) doit être partagé en lecture sur ce
  doc, comme il l'est déjà sur le Sheet.
- Sans `GOOGLE_STYLE_DOC_ID` ou tant que le doc est vide, tout continue de
  fonctionner en dégradé (pas d'erreur) — juste moins précis.
