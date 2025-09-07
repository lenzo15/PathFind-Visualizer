using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;


[CreateAssetMenu(fileName = "ClickGenEnterStrategy", menuName = "Strategy/ClickGenEnterStrategy", order = 0)]
public class ClickGenEnterStrategy : PathStrategy
{
    private List<Cell> cellList;
    private Dictionary<Cell, UnityAction> cellListeners = new Dictionary<Cell, UnityAction>();
    protected override void OnInit()
    {
        cellList = StrategyManager.Instance.cells;
        cellList.ForEach(cell => AddListener(cell));
    }

    protected override void OnDestroy()
    {
        cellList.ForEach(cell => RemoveListener(cell));
        StrategyManager.Instance.ResetStrategy();
    }

    private void AddListener(Cell cell)
    {
        cellListeners[cell] = () => OnClickCell(cell);
        cell.onPointerClick.AddListener(cellListeners[cell]);
    }

    private void RemoveListener(Cell cell)
    {
        cell.onPointerClick.RemoveListener(cellListeners[cell]);
        cellListeners.Remove(cell);
    }

    private void OnClickCell(Cell cell)
    {
        if (!isEnable)
        {
            return;
        }
        if (cell.cellType == CellType.Normal)
        {
            cell.SetCellType(CellType.Start);
            if (StrategyManager.Instance.startCell == null)
            {
                StrategyManager.Instance.startCell = cell;
            }
            else
            {
                StrategyManager.Instance.startCell.SetCellType(CellType.Normal);
                StrategyManager.Instance.startCell = cell;
            }
            Destroy();
        }
    }

    public override string Name()
    {
        return "点击生成入口";
    }
}