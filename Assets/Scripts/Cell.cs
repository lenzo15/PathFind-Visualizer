using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public class Cell : MonoBehaviour, IPointerEnterHandler, IPointerClickHandler
{
    public int x;
    public int y;
    public CellType cellType = CellType.Normal;
    private Color normalColor = Color.white;
    private Color wallColor = Color.gray;
    private Color pathColor = Color.blue;
    private Color startColor = Color.magenta;
    private Color endColor = new Color(0.5f, 0f, 0.5f, 1f);
    private Color researchColor = Color.green;
    private Color visitedColor = Color.yellow;

    public UnityEvent onPointerEnter = new UnityEvent();
    public UnityEvent onPointerClick = new UnityEvent();
    [SerializeField] public Image imgCell;
    public void SetCellType(CellType cellType)
    {
        this.cellType = cellType;
        imgCell.color = cellType switch
        {
            CellType.Normal => normalColor,
            CellType.Wall => wallColor,
            CellType.Start => startColor,
            CellType.End => endColor,
            CellType.Visited => visitedColor,
            CellType.Research => researchColor,
            _ => normalColor,
        };
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        onPointerEnter.Invoke();
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        onPointerClick.Invoke();
    }
}

public enum CellType
{
    Normal,
    Wall,
    Start,
    End,
    Visited,
    Research,
}