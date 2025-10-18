using System;
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using UnityEditor.Search;
using UnityEngine;

[CreateAssetMenu(fileName = "PrimGenMazeStrategy", menuName = "Strategy/PrimGenMazeStrategy", order = 0)]
public class PrimGenMazeStrategy : PathStrategy
{
    public int randomSeed = 0;
    public int delayTime = 200;
    private System.Random random;
    private int mazeCellWidth;
    private int mazeCellHeight;
    private List<Cell> cellList;
    private List<Cell> mazeCells;

    public override string Name()
    {
        return "Prim生成迷宫";
    }

    protected override void OnInit()
    {
        random = new System.Random(randomSeed);
        cellList = StrategyManager.Instance.cells;
        var width = StrategyManager.Instance.width;
        var height = StrategyManager.Instance.height;
        // 为了迷宫美观，确保宽度和高度都是奇数
        if (width % 2 == 0)
        {
            width++;
        }
        if (height % 2 == 0)
        {
            height++;
        }
        MainPanel.Instance.GenerateGrid(width, height);
        mazeCellWidth = (width + 1) >> 1;
        mazeCellHeight = (height + 1) >> 1;
        mazeCells = new List<Cell>(mazeCellWidth * mazeCellHeight);
        foreach (var cell in cellList)
        {
            if (cell.x % 2 == 1 || cell.y % 2 == 1)
            {
                cell.SetCellType(CellType.Wall);
            }
            else
            {
                cell.SetCellType(CellType.Normal);
                mazeCells.Add(cell);
            }
        }
        GenMaze().Forget();
    }

    public async UniTask GenMaze()
    {
        MainPanel.Instance.ShowMask(true);
        await GenMazeInternal();
        MainPanel.Instance.ShowMask(false);
    }

    private async UniTask GenMazeInternal()
    {
        HashSet<Cell> visitedCells = new HashSet<Cell>();
        var firstCell = mazeCells[0];
        firstCell.SetCellType(CellType.Visited);
        visitedCells.Add(firstCell);
        var wallList = new List<WallWithOtherCell>();
        AddNeighborWall(firstCell, wallList);
        while (wallList.Count > 0)
        {
            var currentCell = wallList[random.Next(0, wallList.Count)];
            if (!visitedCells.Contains(currentCell.otherCell))
            {
                currentCell.wall.SetCellType(CellType.Visited);
                currentCell.otherCell.SetCellType(CellType.Visited);
                visitedCells.Add(currentCell.otherCell);
                visitedCells.Add(currentCell.wall);
                AddNeighborWall(currentCell.otherCell, wallList);
                await UniTask.Delay(delayTime);
            }
            wallList.Remove(currentCell);
        }

        foreach (var cell in visitedCells)
        {
            cell.SetCellType(CellType.Normal);
            await UniTask.Delay(delayTime / 2);
        }

        await UniTask.CompletedTask;
        Debug.Log("GenMazeInternal done");
    }

    private void AddNeighborWall(Cell cell, List<WallWithOtherCell> wallList)
    {
        if (cell.x > 1)
        {
            var wall = cellList[cell.x - 1 + cell.y * StrategyManager.Instance.width];
            var otherCell = cellList[cell.x - 2 + cell.y * StrategyManager.Instance.width];
            if (wall.cellType == CellType.Wall)
            {
                wallList.Add(new WallWithOtherCell(wall, otherCell));
            }
        }
        if (cell.x < StrategyManager.Instance.width - 1)
        {
            var wall = cellList[cell.x + 1 + cell.y * StrategyManager.Instance.width];
            var otherCell = cellList[cell.x + 2 + cell.y * StrategyManager.Instance.width];
            if (wall.cellType == CellType.Wall)
            {
                wallList.Add(new WallWithOtherCell(wall, otherCell));
            }
        }
        if (cell.y > 1)
        {
            var wall = cellList[cell.x + (cell.y - 1) * StrategyManager.Instance.width];
            var otherCell = cellList[cell.x + (cell.y - 2) * StrategyManager.Instance.width];
            if (wall.cellType == CellType.Wall)
            {
                wallList.Add(new WallWithOtherCell(wall, otherCell));
            }
        }
        if (cell.y < StrategyManager.Instance.height - 1)
        {
            var wall = cellList[cell.x + (cell.y + 1) * StrategyManager.Instance.width];
            var otherCell = cellList[cell.x + (cell.y + 2) * StrategyManager.Instance.width];
            if (wall.cellType == CellType.Wall)
            {
                wallList.Add(new WallWithOtherCell(wall, otherCell));
            }
        }
    }

    protected override void OnDestroy()
    {
        base.OnDestroy();
    }
}

public class WallWithOtherCell
{
    public Cell wall;
    public Cell otherCell;
    public WallWithOtherCell(Cell wall, Cell otherCell)
    {
        this.wall = wall;
        this.otherCell = otherCell;
    }
}