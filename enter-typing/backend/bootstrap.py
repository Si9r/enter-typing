from sqlalchemy import inspect, text

from backend import models
from backend.database import SessionLocal, engine


def ensure_result_columns():
    inspector = inspect(engine)
    table_columns = {
        table_name: {column["name"] for column in inspector.get_columns(table_name)}
        for table_name in inspector.get_table_names()
    }

    migrations = []
    typing_columns = table_columns.get("typing_histories", set())
    if "content_id" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN content_id INTEGER")
    if "score" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN score INTEGER NOT NULL DEFAULT 0")
    if "typos" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN typos INTEGER NOT NULL DEFAULT 0")
    if "elapsed_seconds" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN elapsed_seconds INTEGER NOT NULL DEFAULT 0")
    if "rank_eligible" not in typing_columns:
        migrations.append("ALTER TABLE typing_histories ADD COLUMN rank_eligible BOOLEAN NOT NULL DEFAULT 0")

    quiz_columns = table_columns.get("quiz_histories", set())
    if "content_id" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN content_id INTEGER")
    if "accuracy" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN accuracy FLOAT NOT NULL DEFAULT 0")
    if "max_combo" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN max_combo INTEGER NOT NULL DEFAULT 0")
    if "rank_eligible" not in quiz_columns:
        migrations.append("ALTER TABLE quiz_histories ADD COLUMN rank_eligible BOOLEAN NOT NULL DEFAULT 0")

    if migrations:
        with engine.begin() as conn:
            for migration in migrations:
                conn.execute(text(migration))


def initialize_database():
    models.Base.metadata.create_all(bind=engine)
    ensure_result_columns()


def seed_default_typing_contents():
    db = SessionLocal()
    try:
        if db.query(models.TypingContent).count() > 0:
            return

        songs = [
            {
                "id": 1,
                "title": "夜に駆ける (밤을 달리다)",
                "artist": "YOASOBI",
                "genre": "JPOP",
                "description": "YOASOBI의 데뷔곡이자 최고 히트곡인 '밤을 달리다'입니다. 빠른 템포와 시적인 가사가 특징이며, 일본어 입력 속도를 높이는 데 아주 좋은 연습 곡입니다. 히라가나와 한자 변환에 유의하며 연습해보세요!",
                "lyrics": "沈むように溶けてゆくように\n二人だけの空が広がる夜に\nさよならだけだった\nその一言で全てが分かった\n日が沈み出した空と君の姿\nフェンス越しに重なっていた",
                "hiragana": "しずむようにとけてゆくように\nふたりだけのそらがひろがるよるに\nさよならだけだった\nそのひとことですべてがわかった\nひがしずみだしたそらときみのすがた\nふぇんすごしにかさなっていた",
                "romaji": "shizumuyounitoketeyukuyouni\nfutaridakenosoragahirogaruyoruni\nsayonaradakedatta\nsonohitokotodesubetegawakatta\nhigashizumidashitasoratokiminosugata\nfensugoshinikasanatteita"
            },
            {
                "id": 2,
                "title": "Lemon",
                "artist": "米津玄師 (Kenshi Yonezu)",
                "genre": "JPOP",
                "description": "국민 히트곡! 요네즈 켄시의 명곡 타이핑",
                "lyrics": "夢ならばどれほどよかったでしょう\n未だにあなたのことを夢にみる\n忘れた物を取りに帰るように\n古びた思い出の埃を払う",
                "hiragana": "ゆめならばどれほどよかったでしょう\nいまだにあなたのことをゆめにみる\nわすれたものをとりにかえるように\nふるびたおもいでのほこりをはらう",
                "romaji": "yumenarabadorehodoyokattadeshou\nimadanianatanokotowoyumenimiru\nwasuretamonowotorinikaeruyouni\nfurubitaomoidenohokoriwoharau"
            },
            {
                "id": 3,
                "title": "マリーゴールド (Marigold)",
                "artist": "あいみょん (Aimyon)",
                "genre": "JPOP",
                "description": "아이묭(Aimyon)의 감성적인 가사 타자 연습",
                "lyrics": "風の強さがちょっと\n心を揺さぶりすぎて\n真面目に見つめた\n君が恋しい",
                "hiragana": "かぜのつよさがちょっと\nこころをゆさぶりすぎて\nまじめにみつめた\nきみがこいしい",
                "romaji": "kazenotsuyosagachotto\nkokorowoyusaburisugite\nmajimenimitsumeta\nkimigakoishii"
            },
            {
                "id": 4,
                "title": "ドライフラワー (Dry Flower)",
                "artist": "優里 (Yuuri)",
                "genre": "JPOP",
                "description": "유우리(Yuuri)의 이별 감성을 담은 명곡",
                "lyrics": "多分私じゃなくていいね\n余裕のない二人だったし\n気付けば喧嘩ばっかりしてさ\nごめんね",
                "hiragana": "たぶんわたしじゃなくていいね\nよゆうのないふたりだったし\nきづけばけんかばっかりしてさ\nごめんね",
                "romaji": "tabunwatashijanakuteiine\nyoyuunonaifutaridattashi\nkidzukebakenkabakkarishitesa\ngomenne"
            }
        ]
        
        for song in songs:
            content = models.TypingContent(**song)
            db.add(content)
        db.commit()
    finally:
        db.close()

