"""Download the five Hugging Face models into ./models (or $MODELS_ROOT)."""
import os
from pathlib import Path

from huggingface_hub import snapshot_download

MODELS = {
    "persian":           os.environ.get("PERSIAN_MODEL_ID",      "HamidRezaei/Persian-Offensive-Language-Detection"),
    "textdetox_large":   os.environ.get("TEXTDETOX_LARGE_ID",    "textdetox/twitter-xlmr-toxicity-classifier"),
    "textdetox_base":    os.environ.get("TEXTDETOX_BASE_ID",     "textdetox/xlmr-base-toxicity-classifier"),
    "multilingual":      os.environ.get("MULTILINGUAL_MODEL_ID", "unitary/multilingual-toxic-xlm-roberta"),
    "twitter_offensive": os.environ.get("TWITTER_OFFENSIVE_ID",  "cardiffnlp/twitter-roberta-base-offensive"),
}

IGNORE = ["*.h5", "*.msgpack", "*.onnx", "*.tflite", "*.ot", "*.mlmodelc"]


def main() -> None:
    root = Path(os.environ.get("MODELS_ROOT", Path(__file__).resolve().parent.parent / "models"))
    for sub, repo_id in MODELS.items():
        target = root / sub
        target.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {repo_id} -> {target}", flush=True)
        snapshot_download(repo_id=repo_id, local_dir=str(target), ignore_patterns=IGNORE)
        print(f"Done {repo_id}", flush=True)


if __name__ == "__main__":
    main()
