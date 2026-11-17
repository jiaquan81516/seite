const SPENDS = [
  {
    merchant: 'Kopi & Toast',
    category: 'Food & Drink',
    method: 'Apple Pay',
    amount: 'S$5.60',
    icon: '☕',
    color: 'peach',
  },
  {
    merchant: 'FairPrice',
    category: 'Groceries',
    method: 'Card',
    amount: 'S$18.40',
    icon: '↟',
    color: 'sage',
  },
  {
    merchant: 'MRT ride',
    category: 'Transport',
    method: 'Card',
    amount: 'S$1.80',
    icon: '↗',
    color: 'blue',
  },
];
export function ProductPreview() {
  return (
    <div
      className="product-preview"
      aria-label="Illustrative preview of email alerts becoming spending entries"
    >
      <div className="preview-orbit" aria-hidden="true" />
      <div className="mail-preview">
        <span className="mail-icon" aria-hidden="true">
          ✉
        </span>
        <div>
          <strong>Bank email received</strong>
          <span>Your card purchase · S$5.60</span>
        </div>
        <span className="mail-dot" aria-hidden="true" />
      </div>
      <div className="preview-connector" aria-hidden="true">
        <span />
        <i>✧</i>
        <span />
      </div>
      <div className="tracker-preview">
        <div className="preview-heading">
          <span>TODAY</span>
          <span className="preview-example">Example</span>
        </div>
        <div className="preview-total">
          <div>
            <span>Spent today</span>
            <strong>S$25.80</strong>
          </div>
          <div className="mini-chart" aria-hidden="true">
            {[24, 44, 30, 58, 40, 70, 51].map((height, index) => (
              <i key={index} style={{ height }} />
            ))}
          </div>
        </div>
        <div className="preview-spends">
          {SPENDS.map((spend) => (
            <div className="preview-spend" key={spend.merchant}>
              <span className={`preview-category ${spend.color}`} aria-hidden="true">
                {spend.icon}
              </span>
              <div>
                <strong>{spend.merchant}</strong>
                <span>
                  {spend.category} · {spend.method}
                </span>
              </div>
              <b>{spend.amount}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
