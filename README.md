# PolyGuard Ensemble

تشخیص محتوای سمی/توهین‌آمیز برای فارسی، فینگیلیش و انگلیسی با رأی‌گیری اجماعی ۵ مدل (FastAPI + رابط شبیه ChatGPT).

## اصلاحات این بازبینی

بازبینی کامل کد، تست‌ها و workflow انجام شد. مهم‌ترین مشکل واقعی که پیدا و رفع شد:

- یک بازبینی قبلی به‌اشتباه ادعا کرده بود که دو شناسه‌ی مدل روی Hugging Face
  وجود ندارند (`HamidRezaei/Persian-Offensive-Language-Detection` و
  `textdetox/xlmr-base-toxicity-classifier`) و آن‌ها را با شناسه‌های دیگری
  جایگزین کرده بود. با بررسی مجدد روی Hub مشخص شد **هر دو ریپو واقعاً وجود
  دارند**؛ شناسه‌های اصلی در `scripts/download_models.py` و
  `.github/workflows/deploy.yml` بازگردانده شدند (همچنان با متغیر محیطی هم
  قابل بازنویسی‌اند).
- حالت امتیازدهی مدل فارسی از `multilabel` به `binary` اصلاح شد، چون مدل واقعی یک
  دسته‌بند دوکلاسه (توهین‌آمیز/غیرتوهین‌آمیز) است، نه چندبرچسبی.
- یک سقف طول درخواست (۲۰۰۰۰ نویسه) به API و رابط کاربری اضافه شد تا یک متن
  بسیار بزرگ نتواند یک ترد پردازشی را بی‌دلیل مشغول نگه دارد (توکنایزر در هر
  صورت در ۵۱۲ توکن قطع می‌کند).
- تمام ۴۶ تست واحد (`pytest`) اجرا و تأیید شدند که سبز هستند؛ منطق `consensus.py` و
  `fingilish.py` بدون تغییر درست بود و نیازی به اصلاح نداشت.

## ساختار

```
.github/workflows/deploy.yml   اجرا روی GitHub Actions + Cloudflare Quick Tunnel
app/main.py                    سرور FastAPI و بارگذاری مدل‌ها
app/consensus.py               منطق رأی‌گیری (بدون torch، تست‌پذیر)
app/fingilish.py               تشخیص فینگیلیش و ترنسلیت به فارسی
app/static/                    رابط کاربری (index.html, style.css, script.js)
scripts/download_models.py     دانلود مدل‌ها از Hugging Face
scripts/start_server.sh        اجرای gunicorn
scripts/smoke_test.py          تست دودی روی سرور در حال اجرا
tests/                         تست‌های واحد
```

## اجرا روی GitHub Actions

۱. ریپو را روی GitHub آپلود کن (شاخه‌ی `main`).
۲. تب **Actions** ← `PolyGuard Ensemble Web + Cloudflare Tunnel` ← **Run workflow**.
۳. آدرس `trycloudflare.com` را در **Summary** اجرا ببین. سرویس حدود ۵ ساعت بالا می‌ماند.

دفعه‌ی اول دانلود مدل‌ها طول می‌کشد؛ دفعه‌های بعد از cache استفاده می‌شود.

## اجرای محلی

```bash
python -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python scripts/download_models.py
./scripts/start_server.sh          # http://localhost:8000
python scripts/smoke_test.py       # تست
```

تست‌های واحد (بدون مدل): `pip install -r requirements-dev.txt && pytest`

## منطق تصمیم‌گیری

- هر مدل با نمره ≥ 0.50 «رأی سمی» می‌دهد.
- ۲ رأی یا بیشتر ← `TOXIC`؛ یک رأی با نمره ≥ 0.90 ← `TOXIC`؛ نمره ≥ 0.60 ← `SUSPECT`؛ در غیر این صورت `SAFE`.
- مدل فقط‌فارسی روی متن انگلیسی و مدل فقط‌انگلیسی روی متن فارسی اجرا نمی‌شود.

## فینگیلیش

فقط `kir` نیست؛ جمله‌های کامل هم پشتیبانی می‌شوند (`to khar hasti`، `khafe sho ahmagh`، `madar jende`، …).

۱. **پاکسازی:** `k1r`، `k!r`، `k.i.r`، `k i r` و `kiiiir` همه به `kir` برمی‌گردند.
۲. **واژه‌نامه:** فهرست توهین‌ها و واژه‌های رایج (`PROFANE` و `FUNCTION` در `app/fingilish.py`) با املای درست فارسی؛ پسوندهای چسبیده (`kiram` ← کیرم) و حروف تکراری (`kharr` ← خر) هم پشتیبانی می‌شوند.
۳. **حرف‌به‌حرف:** برای واژه‌های ناشناخته (دی‌گراف‌ها اول، مصوت‌های کوتاه وسط کلمه حذف).
۴. **کلمات انگلیسی** در نسخه‌ی فارسی حذف می‌شوند: `you are such a kir` ← «کیر».

متن لاتین فقط وقتی فینگیلیش حساب می‌شود که یک توهین فینگیلیش شناخته‌شده داشته باشد یا اکثر کلماتش انگلیسی نباشند.
انگلیسی معمولی **هیچ‌وقت** ترنسلیت نمی‌شود. برای فینگیلیش هم متن اصلی و هم نسخه‌ی فارسی بررسی می‌شود و نتیجه‌ی بدتر برمی‌گردد؛
در نسخه‌ی فارسی‌شده یک مدل تنها برای `TOXIC` بودن حداقل 0.95 لازم دارد.

برای افزودن واژه: `_p('املای فارسی', 'variant1', 'variant2')` برای توهین‌ها و `_f(...)` برای کلمات معمولی.
اگر کلمه‌ی انگلیسی‌ای اشتباه فینگیلیش تشخیص داده شد، آن را به `ENGLISH_WORDS` اضافه کن.

## API

`POST /api/check` با بدنه‌ی `{"text": "..."}` ← `decision`, `confidence`, `votes_count`, `raw_scores`, `fingilish_detected`, `fingilish_text`, `analysis`, `latency_ms`, …
`GET /health` ← وضعیت مدل‌ها (برای هر worker جداگانه است).
