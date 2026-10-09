#!/usr/bin/env bash
# Packs and encrypts a kut backup (ADR-141).
#
#   encrypt.sh PLAINTEXT_DIR OUT_DIR RECIPIENTS_FILE STAMP
#
# Tars kut.dump and manifest.json, encrypts the tar to every age recipient in
# RECIPIENTS_FILE, and writes OUT_DIR/kut-backup-STAMP.tar.age plus a
# .sha256 file with the plaintext tar's hash, so a later decrypt can be
# checked. The plaintext tar is deleted; the plaintext directory stays for the
# restore check, and the workflow deletes it at the end.
set -euo pipefail

plain=${1:?usage: encrypt.sh PLAINTEXT_DIR OUT_DIR RECIPIENTS_FILE STAMP}
out=${2:?usage: encrypt.sh PLAINTEXT_DIR OUT_DIR RECIPIENTS_FILE STAMP}
recipients=${3:?usage: encrypt.sh PLAINTEXT_DIR OUT_DIR RECIPIENTS_FILE STAMP}
stamp=${4:?usage: encrypt.sh PLAINTEXT_DIR OUT_DIR RECIPIENTS_FILE STAMP}

grep -qE '^age1[0-9a-z]{58}$' "$recipients" || {
  echo 'FAILED: the recipients file holds no age public key'
  exit 1
}
mkdir -p "$out"
name="kut-backup-$stamp"
tar_file="$out/$name.tar"
tar -C "$plain" -cf "$tar_file" manifest.json kut.dump
tar_sha=$(sha256sum "$tar_file" | cut -d ' ' -f 1)
age -R "$recipients" -o "$out/$name.tar.age" "$tar_file"
rm -- "$tar_file"
printf '%s  %s.tar\n' "$tar_sha" "$name" > "$out/$name.tar.sha256"
echo "encrypted: $name.tar.age ($(stat -c %s "$out/$name.tar.age") bytes), plaintext tar sha256 $tar_sha"
