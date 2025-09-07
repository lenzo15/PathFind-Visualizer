using System;
using System.Collections.Generic;
using Unity.VisualScripting;
using UnityEngine;
using UnityEngine.Events;


[CreateAssetMenu(fileName = "ClickGenWallStrategy", menuName = "Strategy/ClickGenWallStrategy", order = 0)]
public class ClickGenWallStrategy : PathStrategy
{
    private List<Cell> cellList;
    private Dictionary<Cell, UnityAction> cellClickListeners = new Dictionary<Cell, UnityAction>();
    private Dictionary<Cell, UnityAction> cellEnterListeners = new Dictionary<Cell, UnityAction>();
    protected override void OnInit()
    {
        cellList = StrategyManager.Instance.cells;
        cellList.ForEach(cell => AddListener(cell));
    }

    protected override void OnDestroy()
    {
        cellList.ForEach(cell => RemoveListener(cell));
    }

    private void AddListener(Cell cell)
    {
        cellEnterListeners[cell] = () => OnEnterCell(cell);
        cell.onPointerEnter.AddListener(cellEnterListeners[cell]);
        cellClickListeners[cell] = () => OnClickCell(cell);
        cell.onPointerClick.AddListener(cellClickListeners[cell]);
    }

    private void RemoveListener(Cell cell)
    {
        if (cell == null) return;
        if (cellEnterListeners.ContainsKey(cell))
        {
            cell.onPointerEnter.RemoveListener(cellEnterListeners[cell]);
            cellEnterListeners.Remove(cell);
        }
        if (cellClickListeners.ContainsKey(cell))
        {
            cell.onPointerClick.RemoveListener(cellClickListeners[cell]);
            cellClickListeners.Remove(cell);
        }
    }

    private void OnClickCell(Cell cell)
    {
        if (!isEnable)
        {
            return;
        }
        if (cell.cellType == CellType.Wall)
        {
            cell.SetCellType(CellType.Normal);
        }
        else if (cell.cellType == CellType.Normal)
        {
            cell.SetCellType(CellType.Wall);
        }
    }

    private void OnEnterCell(Cell cell)
    {
        if (!isEnable)
        {
            return;
        }
        if (MouseListener.inputButton == UnityEngine.EventSystems.PointerEventData.InputButton.Right)
        {
            if (cell.cellType == CellType.Wall)
            {
                cell.SetCellType(CellType.Normal);
            }
            else if (cell.cellType == CellType.Normal)
            {
                cell.SetCellType(CellType.Wall);
            }
        }
    }

    protected override void OnSetEnable(bool enable)
    {
        if (enable)
        {
            StrategyManager.Instance.SetGlobalStrategy(this);
        }
    }

    public override string Name()
    {
        return "点击生成";
    }
}