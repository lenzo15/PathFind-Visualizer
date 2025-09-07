using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;


[CreateAssetMenu(fileName = "ClickGenExitStrategy", menuName = "Strategy/ClickGenExitStrategy", order = 0)]
public class ClickGenExitStrategy : PathStrategy
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
        if (cell != null && cellListeners.ContainsKey(cell))
        {
            cell.onPointerClick.RemoveListener(cellListeners[cell]);
            cellListeners.Remove(cell);
        }
    }

    private void OnClickCell(Cell cell)
    {
        if (!isEnable)
        {
            return;
        }
        if (cell.cellType == CellType.Normal)
        {
            cell.SetCellType(CellType.End);
            if (StrategyManager.Instance.endCell == null)
            {
                StrategyManager.Instance.endCell = cell;
            }
            else
            {
                StrategyManager.Instance.endCell.SetCellType(CellType.Normal);
                StrategyManager.Instance.endCell = cell;
            }
            Destroy();
        }
    }

    public override string Name()
    {
        return "点击生成出口";
    }
}