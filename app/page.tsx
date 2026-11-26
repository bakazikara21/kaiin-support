import Link from "next/link";

// ホーム画面：やりたいことを大きなボタン（2列×2段）で選びます
export default function Home() {
  return (
    <main className="page">
      <h1>会員登録おてつだい</h1>
      <p className="lead">高島屋オンラインストアの会員登録を、一人でできるようにお手伝いします。1→2の順に進めてください。</p>

      <div className="menu-grid">
        <Link href="/prepare" className="menu-btn">
          <span className="num">1</span>
          <span className="title">登録する情報を準備する</span>
          <span className="desc">お名前・住所・電話番号などを、このスマートフォンに保存します。</span>
        </Link>

        <Link href="/register" className="menu-btn">
          <span className="num">2</span>
          <span className="title">高島屋で会員登録する</span>
          <span className="desc">手順を1つずつ案内します。入力は自動でできます。</span>
        </Link>

        <Link href="/sweets" className="menu-btn">
          <span className="num">★</span>
          <span className="title">今日のおすすめスイーツ</span>
          <span className="desc">洋菓子・和菓子・果物から、予算と種類で選べます。</span>
        </Link>

        <Link href="/assistant" className="menu-btn">
          <span className="num">?</span>
          <span className="title">AIに聞く</span>
          <span className="desc">会員登録の画面への行き方や、ブックマークの使い方が分からないときに。</span>
        </Link>
      </div>
    </main>
  );
}
