"""Fetch the published, checksum-verified processed ULTRA-MoCap release."""

import argparse
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ARTICLE = "https://api.figshare.com/v2/articles/28751156/versions/1"
DOI = "10.6084/m9.figshare.28751156.v1"
MEMBER = "ULTra-MoCap-processed/All_subjects_data.h5"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / ".local-artifacts/muscle-model"


def digest(path: Path, algorithm: str) -> str:
    result = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def fetch(output: Path):
    output.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(ARTICLE, timeout=60) as response:
        metadata = json.load(response)
    if (
        metadata.get("doi") != DOI
        or metadata.get("license", {}).get("name") != "CC BY 4.0"
    ):
        raise ValueError(
            "Source version or license changed; review the published terms before importing."
        )
    files = [
        item
        for item in metadata["files"]
        if item["name"] == "ULTra-MoCap-processed.zip"
    ]
    if len(files) != 1:
        raise ValueError("Expected exactly one published processed archive.")
    item = files[0]
    if not 0 < item["size"] < 1024**3:
        raise ValueError("Unexpected archive size; review the source metadata.")
    archive = output / item["name"]
    expected = item["computed_md5"]
    if not archive.exists() or digest(archive, "md5") != expected:
        partial = archive.with_suffix(".zip.part")
        print(f"Downloading {item['size'] / 1e6:.0f} MB from Figshare", flush=True)
        with (
            urllib.request.urlopen(item["download_url"], timeout=120) as source,
            partial.open("wb") as target,
        ):
            shutil.copyfileobj(source, target, length=1024 * 1024)
        if partial.stat().st_size != item["size"] or digest(partial, "md5") != expected:
            raise ValueError(f"Source checksum mismatch: {partial}")
        partial.replace(archive)
    with zipfile.ZipFile(archive) as source:
        info = source.getinfo(MEMBER)
        target = output / "All_subjects_data.h5"
        if not target.exists() or target.stat().st_size != info.file_size:
            if shutil.disk_usage(output).free < info.file_size:
                raise ValueError("Insufficient free space for the processed HDF5 file.")
            partial = target.with_suffix(".h5.part")
            with source.open(MEMBER) as stream, partial.open("wb") as destination:
                shutil.copyfileobj(stream, destination, length=1024 * 1024)
            partial.replace(target)
    provenance = {
        "doi": DOI,
        "license": metadata["license"],
        "authors": metadata.get("authors", []),
        "source_url": metadata.get("url_public_html"),
        "archive_md5": expected,
        "hdf5_sha256": digest(target, "sha256"),
        "attribution": metadata["title"],
    }
    (output / "source.json").write_text(
        json.dumps(provenance, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Verified dataset: {target}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        fetch(args.output)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(1, f"Import failed: {error}\n")
