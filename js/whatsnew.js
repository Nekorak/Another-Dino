// Окно «Что нового»: показывается один раз, когда игрок впервые открывает новую версию.
// Новая запись добавляется В НАЧАЛО списка с новым id; игроки, которые её ещё не видели, получат окно.
// id не связан с номером сборки (его ставит CI), поэтому окно работает и в браузере, и в приложениях.
export const NEWS = [
  {
    id: '2026-11-19',
    ro: [
      'Meniu nou, mai simplu: JOACĂ plus Moduri, Colecție, Progres și Setări. Bulinuțele roșii arată unde te așteaptă ceva.',
      'Un boss diferit în fiecare lume din Aventură, o hartă nouă și o poveste scurtă înainte de fiecare lume.',
      'Lumea sezonului: o lume nouă care se schimbă în fiecare anotimp (se deschide și din Pass, la treapta 5).',
      'Regula zilei, traseul săptămânii și tipare noi de obstacole.',
      'Oul de aur, hrană pentru animăluțe, misiuni pe care le poți schimba. Animăluțele de nivel 5 evoluează.',
      'Game over mai clar, puteri cu cronometru, text mai mare pe telefon. Prețurile din magazin au fost reechilibrate.',
    ],
    ru: [
      'Новое, более простое меню: ИГРАТЬ, Режимы, Коллекция, Прогресс и Настройки. Красные точки показывают, где тебя что-то ждёт.',
      'Свой босс в каждом мире Приключения, новая карта и короткая история перед каждым миром.',
      'Мир сезона: новый мир, который меняется каждый сезон (открывается и на 5 ступени пропуска).',
      'Правило дня, трасса недели и новые связки препятствий.',
      'Золотое яйцо, корм для питомцев, задания можно заменить. Питомцы 5 уровня эволюционируют.',
      'Понятнее экран проигрыша, бонусы с таймером, крупнее текст на телефоне. Цены в магазине пересмотрены.',
    ],
    en: [
      'A new, simpler menu: PLAY plus Modes, Collection, Progress and Settings. Red dots show where something is waiting for you.',
      'A different boss in every Adventure world, a new map and a short story before each world.',
      'Season world: a new world that changes every season (also opens at tier 5 of the pass).',
      'Rule of the day, track of the week and new obstacle patterns.',
      'Golden egg, pet food, missions you can swap. Pets at level 5 evolve.',
      'A clearer game over, power-ups with timers, larger text on phones. Shop prices were rebalanced.',
    ],
  },
  {
    id: '2026-11-15',
    ro: [
      'Editor de trasee: desenează un traseu, încearcă-l şi trimite-l prietenilor ca cod QR (Moduri > Editor de trasee).',
      'Animalele de companie cresc pe 5 niveluri cât alergaţi împreună. Nou: broasca, care adună oasele cu limba.',
      'Misiuni săptămânale: 3 misiuni lungi cu premii mari şi un bonus pentru toate trei.',
      'Co-op în reţeaua locală: acelaşi traseu şi 3 inimi comune pentru toată echipa.',
      'Album de medalii pentru fiecare statistică şi galerie pentru pozele din modul foto.',
      'Actualizarea din joc merge acum şi în versiunea portabilă pentru PC.',
      'Multe reparaţii de interfaţă pe telefon şi pe PC.',
    ],
    ru: [
      'Редактор трасс: нарисуй трассу, пройди её и отправь друзьям QR-кодом (Режимы > Редактор трасс).',
      'Питомцы растут до 5 уровня, пока вы бегаете вместе. Новый питомец: лягушка, которая слизывает косточки.',
      'Недельные задания: 3 длинных задания с большими наградами и бонусом за все три.',
      'Кооператив по локальной сети: одна трасса и 3 общих сердца на всю команду.',
      'Альбом медалей за каждую статистику и галерея снимков из фоторежима.',
      'Обновление из игры теперь работает и в portable-версии для ПК.',
      'Много исправлений интерфейса на телефоне и ПК.',
    ],
    en: [
      'Level editor: draw a track, try it and send it to friends as a QR code (Modes > Level editor).',
      'Pets grow over 5 levels as you run together. New pet: the frog, which licks up bones.',
      'Weekly missions: 3 long missions with big rewards and a bonus for all three.',
      'LAN co-op: the same track and 3 shared hearts for the whole team.',
      'A medal album for every statistic and a gallery for photo-mode pictures.',
      'In-game updates now work in the portable PC version too.',
      'Lots of interface fixes on phones and PC.',
    ],
  },
];
