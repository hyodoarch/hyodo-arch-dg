# Image Captions / Image Grid Captions

## 通常キャプション・中央配置・Markdown・内部リンク

![[__image-captions-fixture/住宅 外観 01.svg|**南側外観**と [外部リンク](https://example.com)、<<HOME|ホーム>>|center|240]]

![標準Markdownのキャプション|300](/img/user/__image-captions-fixture/landscape.svg)

## 左右floatと連続画像

![[__image-captions-fixture/landscape.svg|左の画像|left|180]]
![[__image-captions-fixture/住宅 外観 01.svg|右の画像|right|120]]

この本文は左右のfigureに回り込みます。キャプション自体は中央揃えです。狭い画面でも画像が本文幅を超えないことを確認してください。

<div style="clear:both"></div>

## ファイル名・エスケープ・通常画像

![[__image-captions-fixture/landscape.svg|%|200]]

![[__image-captions-fixture/landscape.svg|%.%|200]]

![[__image-captions-fixture/landscape.svg|\%|200]]

![[__image-captions-fixture/landscape.svg|160]]

## Grid 2：日本語・空白・長いキャプション

```image-grid-captions
columns: 2
![[__image-captions-fixture/住宅 外観 01.svg|
## 道路側外観
長い説明は画像の幅に合わせて折り返します。見出しの下に段落として表示します。

### 材料と仕上げ
二つ目の見出しと本文も同じキャプションの中に置けます。
]]
![[__image-captions-fixture/landscape.svg|**太字にしない** <em>HTMLにしない</em>]]
```

## Grid 3

```image-grid-captions
columns: 3
gap: 12
![[__image-captions-fixture/landscape.svg|### 材料と仕上げ]]
![[__image-captions-fixture/住宅 外観 01.svg]]
![[__image-captions-fixture/landscape.svg|405]]
```

## Grid 4

```image-grid-captions
columns: 4
gap: 0
![[__image-captions-fixture/住宅 外観 01.svg|\## 記号として表示]]
![[__image-captions-fixture/landscape.svg|2]]
![[__image-captions-fixture/住宅 外観 01.svg|3]]
![[__image-captions-fixture/landscape.svg|4]]
```

## 最適化pictureとの共存（サイトの既存写真）

```image-grid-captions
columns: 2
![[images/top/yamate_IGP0510a.jpg|既存の写真]]
![[__image-captions-fixture/住宅 外観 01.svg|SVG]]
```

## ブロック内エラー（後続本文は正常）

```image-grid-captions
columns: 3
![[__image-captions-fixture/landscape.svg]]
```

```image-grid-captions
columns: 2
![[missing.jpg]]
![[missing2.jpg]]
```

```image-grid
この識別子は未登録のままです。
```

後続本文が表示されれば、エラーはブロック内に限定されています。
