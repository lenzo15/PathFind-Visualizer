using System;
using System.Collections.Generic;
using UnityEngine;


// [CreateAssetMenu(fileName = "PathFindStrategy", menuName = "PathFindStrategy", order = 0)]
public abstract class PathStrategy : ScriptableObject
{
    [NonSerialized] protected bool isEnable = false;
    public abstract string Name();
    [NonSerialized] public bool isInit = false;
    public virtual void Init()
    {
        OnInit();
        isInit = true;
    }
    protected virtual void OnInit()
    {

    }
    public virtual void Destroy()
    {
        OnDestroy();
        isInit = false;
        isEnable = false;
    }
    protected virtual void OnDestroy() { }
    public void SetEnable(bool enable)
    {
        this.isEnable = enable;
        OnSetEnable(enable);
    }

    protected virtual void OnSetEnable(bool enable)
    {

    }
}